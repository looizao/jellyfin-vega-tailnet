import type {KeplerTurboModule} from '@amazon-devices/keplerscript-turbomodule-api';
import {TurboModuleRegistry} from '@amazon-devices/keplerscript-turbomodule-api';

export interface Spec extends KeplerTurboModule {
  start(config: string): Promise<string>;
  status(): Promise<string>;
  stop(): Promise<boolean>;
  checkServer(): Promise<string>;
  engineVersion(): string;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Tailscale');
