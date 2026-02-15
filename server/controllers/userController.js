const User = require("../models/User");

// CREATE
exports.createUser = async (req, res) => {
  const user = await User.create(req.body);
  res.json(user);
};

// READ
exports.getUsers = async (req, res) => {
  const users = await User.find();
  res.json(users);
};

// UPDATE
exports.updateUser = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(user);
};

// DELETE
exports.deleteUser = async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: "User deleted" });
};
