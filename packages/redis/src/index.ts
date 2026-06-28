import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') })

import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URI!);