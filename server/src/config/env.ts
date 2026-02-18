// Load environment variables BEFORE any other imports
// This file must be imported first in app.ts
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
