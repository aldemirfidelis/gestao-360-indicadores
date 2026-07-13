import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { BiometricController } from '../../modules/personnel/biometric.controller';
import { KioskController } from '../../modules/personnel/kiosk.controller';
import { SENSITIVE_BODY_KEY } from './sensitive-body.decorator';

describe('@SensitiveBody', () => {
  it('protects every mutating biometric endpoint through class metadata', () => {
    expect(Reflect.getMetadata(SENSITIVE_BODY_KEY, BiometricController)).toBe(true);
  });

  it('protects kiosk identification without suppressing device-management bodies', () => {
    expect(Reflect.getMetadata(SENSITIVE_BODY_KEY, KioskController.prototype.identifyPunch)).toBe(true);
    expect(Reflect.getMetadata(SENSITIVE_BODY_KEY, KioskController.prototype.createDevice)).toBeUndefined();
    expect(Reflect.getMetadata(SENSITIVE_BODY_KEY, KioskController.prototype.setDeviceActive)).toBeUndefined();
  });
});
