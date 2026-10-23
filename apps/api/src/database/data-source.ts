import { resolve } from 'node:path';
import { config as loadEnvironment } from 'dotenv';
import { DataSource } from 'typeorm';
import { validateEnvironment } from '../config/environment.js';

loadEnvironment({ path: resolve(process.cwd(), '../../.env') });

const environment = validateEnvironment(process.env);

export default new DataSource({
  type: 'postgres',
  url: environment.DATABASE_URL,
  entities: [resolve(process.cwd(), 'dist/**/*.entity.js')],
  migrations: [resolve(process.cwd(), 'dist/database/migrations/*.js')],
  synchronize: false,
});
