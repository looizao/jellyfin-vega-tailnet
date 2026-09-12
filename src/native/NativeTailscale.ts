import type {KeplerTurboModule} from '@amazon-devices/keplerscript-turbomodule-api';
import {TurboModuleRegistry} from '@amazon-devices/keplerscript-turbomodule-api';

export interface Spec extends KeplerTurboModule {
  connect(authKey: string, hostname: string): Promise<string>;
  status(): Promise<string>;
  disconnect(): Promise<boolean>;
  probe(address: string): Promise<string>;
  engineVersion(): string;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Tailscale');
