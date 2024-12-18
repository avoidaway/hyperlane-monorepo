import { z } from 'zod';

import type { Mailbox } from '@hyperlane-xyz/core';
import type { Address, ParsedMessage } from '@hyperlane-xyz/utils';

import type { UpgradeConfig } from '../deploy/proxy.js';
import type { CheckerViolation } from '../deploy/types.js';
import type { IsmConfig } from '../ism/types.js';
import type { ChainName } from '../types.js';

import { CoreConfigSchema, DerivedCoreConfigSchema } from './schemas.js';

export type CoreConfig = z.infer<typeof CoreConfigSchema> & {
  remove?: boolean;
  upgrade?: UpgradeConfig;
};

export type DerivedCoreConfig = z.infer<typeof DerivedCoreConfigSchema>;

export enum CoreViolationType {
  Mailbox = 'Mailbox',
  ConnectionManager = 'ConnectionManager',
  ValidatorAnnounce = 'ValidatorAnnounce',
}

export enum MailboxViolationType {
  DefaultIsm = 'DefaultIsm',
  NotProxied = 'NotProxied',
}

export interface MailboxViolation extends CheckerViolation {
  type: CoreViolationType.Mailbox;
  subType: MailboxViolationType;
  contract: Mailbox;
}

export interface MailboxMultisigIsmViolation extends MailboxViolation {
  actual: Address;
  expected: IsmConfig;
}

export interface ValidatorAnnounceViolation extends CheckerViolation {
  type: CoreViolationType.ValidatorAnnounce;
  chain: ChainName;
  validator: Address;
  actual: boolean;
  expected: boolean;
}

export type DispatchedMessage = {
  id: string;
  message: string;
  parsed: ParsedMessage;
};
