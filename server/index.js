import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import axios from "axios";
import multer from "multer";
import path from "path";
import UserModel from "./models/userModel.js";
import PlantModel from "./models/plantModel.js";

dotenv.config();
const app = express()
;
app.use(cors(
{
    origin: "https://plant-care-client.onrender.com", 
  }
));



app.get("/health", (req, res) => res.status(200).send("OK"));


app.get("/nearby-nurseries", async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "Missing coordinates" });

  try {
    const radius = 1000; 
    const overpassQuery = `
[out:json];
(
  node["shop"="garden_centre"](around:${radius},${lat},${lon});
  node["amenity"="nursery"](around:${radius},${lat},${lon});
);
out;
`;
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
    const response = await axios.get(overpassUrl);
    const elements = response.data.elements;

    // Map nurseries from Overpass
   let nurseries = elements.map(el => ({
  name: el.tags?.name || "Unnamed Nursery",
  latitude: Number(el.lat),
  longitude: Number(el.lon),
  address: el.tags?.["addr:street"] || "No address available",
}));
const fallbackDistance = 0.001;

nurseries = [
  {
    name: "Nursery Near You 1",
    latitude: Number(lat) + fallbackDistance,
    longitude: Number(lon) + fallbackDistance,
    address: "Nearby street"
  },
  {
    name: "Nursery Near You 2",
    latitude: Number(lat) - fallbackDistance,
    longitude: Number(lon) - fallbackDistance,
    address: "Nearby street"
  }
];


    // If Overpass returns nothing, provide dynamic nearby points as fallback
    if (nurseries.length === 0) {
      const fallbackDistance = 0.001; // ~100m offset
      nurseries = [
        { name: "Nursery Near You 1", latitude: parseFloat(lat) + fallbackDistance, longitude: parseFloat(lon) + fallbackDistance, address: "Nearby street" },
        { name: "Nursery Near You 2", latitude: parseFloat(lat) - fallbackDistance, longitude: parseFloat(lon) - fallbackDistance, address: "Nearby street" },
      ];
    }

    res.json(nurseries);
  } catch (err) {
    console.error("Overpass API error:", err.message);
    // Fallback dynamic nurseries if Overpass fails
    const fallbackDistance = 0.001; // ~100m offset
    const fallbackNurseries = [
      { name: "Nursery Near You 1", latitude: parseFloat(lat) + fallbackDistance, longitude: parseFloat(lon) + fallbackDistance, address: "Nearby street" },
      { name: "Nursery Near You 2", latitude: parseFloat(lat) - fallbackDistance, longitude: parseFloat(lon) - fallbackDistance, address: "Nearby street" },
    ];
    res.json(fallbackNurseries);
  }
});

// Middleware
app.use(express.json());

// Serve uploaded images
app.use("/uploads", express.static("uploads"));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected...."))
  .catch(err => console.error("MongoDB Error:", err));

// Register User
app.post("/register", async (req, res) => {
  console.log("Register request received:", req.body);

  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required", success: false });
    }

    const userExist = await UserModel.findOne({ email });
    if (userExist) {
      return res.status(400).json({ message: "User already exists", success: false });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await UserModel.create({ name, email, password: hashedPassword });

    return res.status(201).json({ message: "Registration successful", success: true, user: newUser });
  } catch (err) {
    return res.status(500).json({ message: "Server error", success: false, error: err.message });
  }
});

// Create Plant
app.post("/plants", upload.single("image"), async (req, res) => {
  try {
    const { userId, plantName, species, wateringFrequency, lastWateredDate } = req.body;

    if (!userId || !plantName || !species || !wateringFrequency || !lastWateredDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }
      const last = new Date(lastWateredDate);
const freq = Number(wateringFrequency);

if (isNaN(last) || !Number.isFinite(freq)) {
  return res.status(400).json({ message: "Invalid lastWateredDate or wateringFrequency" });
}

const next = new Date(last);
next.setDate(next.getDate() + freq);


    const newPlant = new PlantModel({
      userId,
      plantName,
      species,
      wateringFrequency:freq,
      lastWateredDate:last,
     nextWateringDate: next,
    imageUrl: req.file ? `/uploads/${req.file.filename}` : null
    });

    const savedPlant = await newPlant.save();

    return res.status(201).json({
      message: "Plant added successfully",
      plant: savedPlant
    });
  } catch (err) {
    console.error("Create plant error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Get all plants for a user
app.get("/plants/:userId", async (req, res) => {
  try {
    const plants = await PlantModel.find({ userId: req.params.userId });
    return res.json(plants);
  } catch (err) {
    console.error("Get plants error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

//  New route to get all plants
app.get("/getPlants", async (req, res) => {
  try {
    const plants = await PlantModel.find();
    res.json({ plants });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Plant
app.put("/plants/:id", upload.single("image"), async (req, res) => {
  try {
    const freq = Number(req.body.wateringFrequency);
    const last = req.body.lastWateredDate ? new Date(req.body.lastWateredDate) : null;

    const updateData = {
      plantName: req.body.plantName,
      species: req.body.species,
      ...(Number.isFinite(freq) ? { wateringFrequency: freq } : {}),
      ...(last ? { lastWateredDate: last } : {}),
};


    if (req.file) {
      updateData.imageUrl = `/uploads/${req.file.filename}`;
    }
      if (Number.isFinite(freq) || last) {
  const existing = await PlantModel.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: "Plant not found" });

  const baseLast = last ?? existing.lastWateredDate;
  const baseFreq = Number.isFinite(freq) ? freq : existing.wateringFrequency;

  if (baseLast && Number.isFinite(baseFreq)) {
    const next = new Date(baseLast);
    next.setDate(next.getDate() + baseFreq);
    updateData.nextWateringDate = next;
  }
}


    const updatedPlant = await PlantModel.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    return res.json(updatedPlant);
  } catch (err) {
    console.error("Update plant error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Delete Plant
app.delete("/plants/:id", async (req, res) => {
  try {
    await PlantModel.findByIdAndDelete(req.params.id);
    res.json({ message: "Plant deleted successfully" });
  } catch (err) {
    console.error("Delete plant error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


// Login User
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required", success: false });
    }

    const user = await UserModel.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found", success: false });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Incorrect password", success: false });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
    return res.json({ message: "Login successful", success: true, token, user });
  } catch (err) {
    return res.status(500).json({ message: "Server error", success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 7500;
app.listen(PORT, () => console.log(`Server running on port : ${PORT}`));





