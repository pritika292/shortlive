import bcrypt from "bcrypt";

const COST = 12;

export function hash(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verify(plain: string, stored: string): Promise<boolean> {
  return bcrypt.compare(plain, stored);
}
