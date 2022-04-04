import { expect } from 'chai';
import { types } from '@abacus-network/utils';
import { AbacusCore } from '@abacus-network/sdk';
import { CoreConfig } from './types';
import {
  ViolationType,
  ValidatorViolation,
  ValidatorManagerViolation,
  AbacusAppChecker,
} from '../check';

export class AbacusCoreChecker extends AbacusAppChecker<
  AbacusCore,
  CoreConfig
> {
  async checkDomain(domain: types.Domain): Promise<void> {
    await this.checkOwnership(domain);
    await this.checkProxiedContracts(domain);
    await this.checkOutbox(domain);
    await this.checkInboxes(domain);
    await this.checkXAppConnectionManager(domain);
    await this.checkValidatorManager(domain);
  }

  async checkOwnership(domain: types.Domain): Promise<void> {
    const contracts = this.app.mustGetContracts(domain);
    const owners = [
      contracts.validatorManager.owner(),
      contracts.xAppConnectionManager.owner(),
      contracts.upgradeBeaconController.owner(),
      contracts.outbox.owner(),
    ];
    this.app.remoteDomainNumbers(domain).map((remote) => {
      owners.push(this.app.mustGetInbox(remote, domain).owner());
    });
    const actual = await Promise.all(owners);
    const expected = this.owners[domain];
    actual.map((_) => expect(_).to.equal(expected));
  }

  async checkOutbox(domain: types.Domain): Promise<void> {
    const contracts = this.app.mustGetContracts(domain);
    const outbox = contracts.outbox;
    // validatorManager is set on Outbox
    const actualManager = await outbox.validatorManager();
    const expectedManager = contracts.validatorManager.address;
    if (actualManager !== expectedManager) {
      const violation: ValidatorManagerViolation = {
        domain: domain,
        type: ViolationType.ValidatorManager,
        actual: actualManager,
        expected: expectedManager,
      };
      this.addViolation(violation);
    }
  }

  async checkValidatorManager(domain: types.Domain): Promise<void> {
    const manager = this.app.mustGetContracts(domain).validatorManager;

    for (const d of this.app.domainNumbers) {
      const name = this.app.mustResolveDomainName(d);
      const expected = this.config.validators[name];
      expect(expected).to.not.be.undefined;
      const actual = await manager.validators(d);
      expect(actual).to.not.be.undefined;
      if (actual !== expected && expected !== undefined) {
        const violation: ValidatorViolation = {
          local: domain,
          remote: d,
          type: ViolationType.Validator,
          actual,
          expected,
        };
        this.addViolation(violation);
      }
    }
  }

  async checkInboxes(domain: types.Domain): Promise<void> {
    // Check that all inboxes on this domain are pointed to the right validator
    // manager.
    const contracts = this.app.mustGetContracts(domain);
    const validatorManager = contracts.validatorManager;
    await Promise.all(
      this.app.remoteDomainNumbers(domain).map(async (remote) => {
        expect(
          await this.app.mustGetInbox(remote, domain).validatorManager(),
        ).to.equal(validatorManager.address);
      }),
    );

    // Check that all inboxes on this domain share the same implementation and
    // UpgradeBeacon.
    const inboxes = Object.values(contracts.addresses.inboxes);
    const implementations = inboxes.map((r) => r.implementation);
    const identical = (a: any, b: any) => (a === b ? a : false);
    const upgradeBeacons = inboxes.map((r) => r.beacon);
    expect(implementations.reduce(identical)).to.not.be.false;
    expect(upgradeBeacons.reduce(identical)).to.not.be.false;
  }

  async checkXAppConnectionManager(domain: types.Domain): Promise<void> {
    const contracts = this.app.mustGetContracts(domain);
    for (const remote of this.app.remoteDomainNumbers(domain)) {
      // inbox is enrolled in xAppConnectionManager
      const enrolledInbox = await contracts.xAppConnectionManager.domainToInbox(
        remote,
      );
      expect(enrolledInbox).to.equal(
        this.app.mustGetInbox(remote, domain).address,
      );
    }
    // Outbox is set on xAppConnectionManager
    const outbox = await contracts.xAppConnectionManager.outbox();
    expect(outbox).to.equal(contracts.outbox.address);
  }

  async checkProxiedContracts(domain: types.Domain): Promise<void> {
    const addresses = this.app.mustGetContracts(domain).addresses;
    // Outbox upgrade setup contracts are defined
    await this.checkProxiedContract(domain, 'Outbox', addresses.outbox);

    const inboxes = Object.values(addresses.inboxes);
    await Promise.all(
      inboxes.map((inbox) => {
        return this.checkProxiedContract(domain, 'Inbox', inbox);
      }),
    );
  }
}