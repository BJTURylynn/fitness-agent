import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const modelConfigs = sqliteTable('model_configs', {
  userId: text('user_id').primaryKey().notNull(),
  name: text('name').notNull(),
  baseUrl: text('base_url').notNull(),
  model: text('model').notNull(),
  encryptedKey: text('encrypted_key').notNull(),
  updatedAt: text('updated_at').notNull(),
  verifiedAt: text('verified_at'),
});
