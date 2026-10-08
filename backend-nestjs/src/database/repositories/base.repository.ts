import type {
  EntityManager,
  EntityTarget,
  ObjectLiteral,
  Repository,
} from 'typeorm';

// Repositories wrap an EntityManager so the same class works inside a
// transaction: withManager(tx) returns a copy bound to the transaction.
export abstract class BaseRepository<T extends ObjectLiteral> {
  protected constructor(
    protected readonly manager: EntityManager,
    private readonly entity: EntityTarget<T>,
  ) {}

  protected get repo(): Repository<T> {
    return this.manager.getRepository(this.entity);
  }

  withManager(manager: EntityManager): this {
    const Ctor = this.constructor as new (manager: EntityManager) => this;
    return new Ctor(manager);
  }
}
