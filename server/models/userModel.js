
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    profilePic: {
      type: String,
      default: "https://www.nicepng.com/png/detail/933-9332131_profile-picture-default-png.png"
    } 
  },
  {
    timestamps: true, 
    versionKey: false
  }
);

const UserModel = mongoose.model("users", userSchema);

export default UserModel;

