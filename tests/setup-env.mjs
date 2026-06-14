process.env.DATABASE_URL ||= "postgresql://user:password@localhost:5432/test";
process.env.JWT_SECRET ||= "x".repeat(64);
process.env.NODE_ENV ||= "test";
