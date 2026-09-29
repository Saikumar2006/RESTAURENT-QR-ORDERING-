const authService = require("../services/authService");
const prisma = require("../config/db");
const { ok, created, asyncHandler } = require("../utils/http");

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body.email, req.body.password);
  ok(res, result);
});

const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  ok(res, { id: user.id, name: user.name, email: user.email, role: user.role, restaurantId: user.restaurantId });
});

const registerRestaurant = asyncHandler(async (req, res) => {
  const restaurant = await authService.registerRestaurant(req.body);
  created(res, restaurant);
});

module.exports = { login, me, registerRestaurant };
