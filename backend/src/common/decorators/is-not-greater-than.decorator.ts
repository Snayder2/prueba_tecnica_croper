import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/**
 * Fails when the property is greater than another numeric property of the same
 * object. Message: "<property> must not be greater than <other>". If either
 * value is missing or not a number, it passes (other validators report that).
 */
export function IsNotGreaterThan(otherProperty: string, options?: ValidationOptions) {
  return (target: object, propertyName: string) => {
    registerDecorator({
      name: 'isNotGreaterThan',
      target: target.constructor,
      propertyName,
      constraints: [otherProperty],
      options: {
        message: `$property must not be greater than ${otherProperty}`,
        ...options,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const other = (args.object as Record<string, unknown>)[otherProperty];
          if (typeof value !== 'number' || typeof other !== 'number') {
            return true;
          }
          return value <= other;
        },
      },
    });
  };
}
