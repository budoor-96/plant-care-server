
import mongoose from "mongoose";

const plantSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true }, 
    plantName: { type: String, required: true, trim: true },
    species: { type: String, required: true }, 
    wateringFrequency: { type: Number, required: true, min: 1 }, 
    lastWateredDate: { type: Date, required: true },
    nextWateringDate: { type: Date }, 
    isIndoor: { type: Boolean, default: true }, 
    location: { type: String, default: null }, 
    imageUrl: { type: String, default: null }
  },
  {
     timestamps: true,
     versionKey: false
  }
);

const PlantModel = mongoose.model("plants", plantSchema);

export default PlantModel;
