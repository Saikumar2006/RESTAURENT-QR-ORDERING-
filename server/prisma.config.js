// prisma.config.js — Required by Prisma v7.
// In Prisma v7 the database URL is no longer read from schema.prisma.
// It must be declared here (and loaded via dotenv before Prisma CLI runs).
require("dotenv").config();

const { defineConfig } = require("prisma/config");

module.exports = defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
