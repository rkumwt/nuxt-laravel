import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  registerDecorator,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidationOptions,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { DataSource, type EntityTarget, type ObjectLiteral } from 'typeorm';
import { label } from './rules.js';

// unique:table,column — an async constraint resolved from Nest's container
// (main.ts calls class-validator's useContainer), so it can query the database
@ValidatorConstraint({ name: 'isUnique', async: true })
@Injectable()
export class IsUniqueConstraint implements ValidatorConstraintInterface {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async validate(value: unknown, args: ValidationArguments) {
    if (typeof value !== 'string') return true;
    const [entity, column] = args.constraints as [
      EntityTarget<ObjectLiteral>,
      string,
    ];
    return !(await this.dataSource
      .getRepository(entity)
      .existsBy({ [column]: value }));
  }
}

export function IsUnique(
  entity: EntityTarget<ObjectLiteral>,
  column: string,
  options?: ValidationOptions,
) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      target: object.constructor,
      propertyName,
      constraints: [entity, column],
      options: {
        message: `The ${label(propertyName)} has already been taken.`,
        ...options,
      },
      validator: IsUniqueConstraint,
    });
}
