CREATE TABLE `model_configs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`model` text NOT NULL,
	`encrypted_key` text NOT NULL,
	`updated_at` text NOT NULL,
	`verified_at` text
);
