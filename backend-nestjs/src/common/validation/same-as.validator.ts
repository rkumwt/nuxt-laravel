import { registerDecorator, type ValidationArguments } from 'class-validator';
import { label } from './rules.js';

/** same:other — compares with another property of the same DTO */
export function SameAs(other: string) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'sameAs',
      target: object.constructor,
      propertyName,
      constraints: [other],
      options: {
        message: `The ${label(propertyName)} field must match ${label(other)}.`,
      },
      validator: {
        validate: (value: unknown, args: ValidationArguments) =>
          value === (args.object as Record<string, unknown>)[other],
      },
    });
}
