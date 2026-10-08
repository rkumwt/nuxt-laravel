import bcrypt from "bcryptjs";

// Laravel's Hash facade (bcrypt driver)
export class PasswordHasher {
  constructor(private readonly rounds: number) {}

  make(plain: string) {
    return bcrypt.hash(plain, this.rounds);
  }

  check(plain: string, hashed: string | null | undefined) {
    if (!hashed) return Promise.resolve(false);
    return bcrypt.compare(plain, hashed);
  }
}
