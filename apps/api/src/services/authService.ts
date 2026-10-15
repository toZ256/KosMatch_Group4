import bcrypt from 'bcryptjs';
import type { AuthResult, LoginInput, RegisterInput } from '@kosmatch/shared';
import type { Repository } from '../data/repository';
import { signToken, toPublicUser } from '../middleware/auth';
import { AppError } from '../middleware/http';

export class AuthService {
  constructor(
    private readonly repo: Repository,
    private readonly jwtSecret: string,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    if (await this.repo.users.findByEmail(input.email)) {
      throw new AppError('VALIDATION_ERROR', 'Email sudah terdaftar');
    }
    const passwordHash = await bcrypt.hash(input.password, 8);
    const user = await this.repo.users.create({
      nama: input.nama,
      email: input.email,
      passwordHash,
      role: input.role,
    });
    const pub = toPublicUser(user);
    return { token: signToken(pub, this.jwtSecret), user: pub };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.repo.users.findByEmail(input.email);
    // Same message for unknown email and wrong password to avoid account enumeration.
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new AppError('UNAUTHORIZED', 'Email atau password salah');
    }
    const pub = toPublicUser(user);
    return { token: signToken(pub, this.jwtSecret), user: pub };
  }
}
