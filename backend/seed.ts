import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

// Default to local MongoDB if not specified in .env
const mongoBaseUri = process.env.MONGO_URI_SEED || "mongodb://localhost:27017";

console.log(`Connecting to MongoDB for seeding at: ${mongoBaseUri}`);

const userDb = mongoose.createConnection(`${mongoBaseUri}/ecoalert-user-db`);
const alertDb = mongoose.createConnection(`${mongoBaseUri}/ecoalert-alert-db`);
const gisDb = mongoose.createConnection(`${mongoBaseUri}/ecoalert-gis-db`);

// Define Schemas manually for seeding to avoid complex imports
// NOTE: includes isDeleted/deletedAt/createdBy/updatedBy to match baseSchemaPlugin
// used by the real service models — otherwise Mongoose's pre-find hook
// (which filters `isDeleted: false`) will never match these seeded docs.
const userSchema = new mongoose.Schema(
  {
    email: String,
    password: { type: String, select: false },
    fullName: String,
    phone: String,
    role: String,
    isVerified: Boolean,
    isActive: Boolean,
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
    deletedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const alertSchema = new mongoose.Schema(
  {
    citizenId: String,
    title: String,
    description: String,
    category: String,
    status: String,
    severity: String,
    location: {
      type: { type: String, default: "Point" },
      coordinates: [Number],
    },
    address: String,
    mediaUrls: [String],
    assignedOfficerId: String,
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
    deletedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const locationSchema = new mongoose.Schema(
  {
    alertId: String,
    category: String,
    severity: String,
    status: String,
    location: {
      type: { type: String, default: "Point" },
      coordinates: [Number],
    },
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
    deletedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const serviceAreaSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    administrativeLevel: { type: String, required: true },
    parentCode: String,
    geometry: {
      type: { type: String, required: true },
      coordinates: { type: mongoose.Schema.Types.Mixed, required: true },
    },
    assignedOfficerIds: [String],
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
    deletedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const User = userDb.model("User", userSchema);
const Alert = alertDb.model("Alert", alertSchema);
const Location = gisDb.model("Location", locationSchema);
const ServiceArea = gisDb.model("ServiceArea", serviceAreaSchema);

async function seed() {
  try {
    console.log("Clearing old data...");
    await User.deleteMany({});
    await Alert.deleteMany({});
    await Location.deleteMany({});
    await ServiceArea.deleteMany({});

    console.log("Seeding Users...");
    const hashPassword = (pw: string) => bcrypt.hashSync(pw, 10);

    const users = await User.insertMany([
      {
        email: "admin@gmail.com",
        password: hashPassword("admin123"),
        fullName: "Super Admin",
        role: "ADMIN",
        isVerified: true,
        isActive: true,
        isDeleted: false,
      },
      {
        email: "officer1@gmail.com",
        password: hashPassword("officer123"),
        fullName: "John Doe",
        role: "OFFICER",
        isVerified: true,
        isActive: true,
        isDeleted: false,
      },
      {
        email: "officer2@gmail.com",
        password: hashPassword("officer123"),
        fullName: "Jane Smith",
        role: "OFFICER",
        isVerified: true,
        isActive: true,
        isDeleted: false,
      },
      {
        email: "citizen1@gmail.com",
        password: hashPassword("citizen123"),
        fullName: "Alice Johnson",
        role: "CITIZEN",
        isVerified: true,
        isActive: true,
        isDeleted: false,
      },
      {
        email: "citizen2@gmail.com",
        password: hashPassword("citizen123"),
        fullName: "Bob Williams",
        role: "CITIZEN",
        isVerified: true,
        isActive: true,
        isDeleted: false,
      },
      {
        email: "citizen3@gmail.com",
        password: hashPassword("citizen123"),
        fullName: "Charlie Brown",
        role: "CITIZEN",
        isVerified: true,
        isActive: true,
        isDeleted: false,
      },
      {
        email: "citizen4@gmail.com",
        password: hashPassword("citizen123"),
        fullName: "David Clark",
        role: "CITIZEN",
        isVerified: true,
        isActive: true,
        isDeleted: false,
      },
      {
        email: "citizen5@gmail.com",
        password: hashPassword("citizen123"),
        fullName: "Eve Davis",
        role: "CITIZEN",
        isVerified: true,
        isActive: true,
        isDeleted: false,
      },
    ]);

    const admin = users[0];
    const officer1 = users[1];
    const officer2 = users[2];
    const citizen1 = users[3];
    const citizen2 = users[4];
    const citizen3 = users[5];
    const citizen4 = users[6];
    const citizen5 = users[7];

    console.log("Seeding Alerts & Locations...");
    // Base coordinate: Ho Chi Minh City roughly [106.6297, 10.8231]
    const alertsData = [
      {
        citizenId: citizen1._id.toString(),
        title: "Waste Dumping in Park",
        description: "Someone dumped trash.",
        category: "illegal_dumping",
        status: "pending",
        severity: "medium",
        address: "Park A",
        location: { type: "Point", coordinates: [106.63, 10.82] },
        isDeleted: false,
      },
      {
        citizenId: citizen2._id.toString(),
        title: "Fallen Tree on Road",
        description: "Tree blocking road.",
        category: "fallen_tree",
        status: "verified",
        severity: "high",
        address: "Street B",
        location: { type: "Point", coordinates: [106.64, 10.83] },
        isDeleted: false,
      },
      {
        citizenId: citizen3._id.toString(),
        title: "Flooded Street",
        description: "Water level high.",
        category: "flooding",
        status: "assigned",
        severity: "high",
        assignedOfficerId: officer1._id.toString(),
        address: "Street C",
        location: { type: "Point", coordinates: [106.65, 10.81] },
        isDeleted: false,
      },
      {
        citizenId: citizen4._id.toString(),
        title: "Air Pollution from Factory",
        description: "Black smoke.",
        category: "air_pollution",
        status: "in_progress",
        severity: "critical",
        assignedOfficerId: officer2._id.toString(),
        address: "Factory Zone",
        location: { type: "Point", coordinates: [106.66, 10.84] },
        isDeleted: false,
      },
      {
        citizenId: citizen5._id.toString(),
        title: "Water Pollution",
        description: "Chemical spill.",
        category: "water_pollution",
        status: "resolved",
        severity: "critical",
        assignedOfficerId: officer1._id.toString(),
        address: "River X",
        location: { type: "Point", coordinates: [106.62, 10.85] },
        isDeleted: false,
      },
      {
        citizenId: citizen1._id.toString(),
        title: "Illegal Burning",
        description: "Burning trash.",
        category: "illegal_burning",
        status: "closed",
        severity: "low",
        assignedOfficerId: officer2._id.toString(),
        address: "Empty Lot",
        location: { type: "Point", coordinates: [106.61, 10.8] },
        isDeleted: false,
      },
      {
        citizenId: citizen2._id.toString(),
        title: "Dead Animal",
        description: "Dead dog on road.",
        category: "wildlife_threat",
        status: "pending",
        severity: "low",
        address: "Highway 1",
        location: { type: "Point", coordinates: [106.67, 10.86] },
        isDeleted: false,
      },
      {
        citizenId: citizen3._id.toString(),
        title: "Blocked Drain",
        description: "Drain is clogged.",
        category: "flooding",
        status: "pending",
        severity: "medium",
        address: "Alley 2",
        location: { type: "Point", coordinates: [106.68, 10.87] },
        isDeleted: false,
      },
      {
        citizenId: citizen4._id.toString(),
        title: "Dangerous Infrastructure",
        description: "Broken electrical pole.",
        category: "other",
        status: "verified",
        severity: "high",
        address: "Street D",
        location: { type: "Point", coordinates: [106.69, 10.88] },
        isDeleted: false,
      },
      {
        citizenId: citizen5._id.toString(),
        title: "Noise Pollution",
        description: "Loud construction at night.",
        category: "noise_pollution",
        status: "pending",
        severity: "low",
        address: "Building E",
        location: { type: "Point", coordinates: [106.6, 10.79] },
        isDeleted: false,
      },
      {
        citizenId: citizen1._id.toString(),
        title: "Pothole on Main Street",
        description: "Huge pothole.",
        category: "other",
        status: "pending",
        severity: "medium",
        address: "Main St",
        location: { type: "Point", coordinates: [106.635, 10.825] },
        isDeleted: false,
      },
      {
        citizenId: citizen2._id.toString(),
        title: "Smell of Gas",
        description: "Strong gas smell.",
        category: "air_pollution",
        status: "verified",
        severity: "critical",
        address: "Block F",
        location: { type: "Point", coordinates: [106.645, 10.835] },
        isDeleted: false,
      },
      {
        citizenId: citizen3._id.toString(),
        title: "River Trash",
        description: "Plastics in river.",
        category: "water_pollution",
        status: "assigned",
        severity: "high",
        assignedOfficerId: officer1._id.toString(),
        address: "River Y",
        location: { type: "Point", coordinates: [106.655, 10.815] },
        isDeleted: false,
      },
      {
        citizenId: citizen4._id.toString(),
        title: "Traffic light broken",
        description: "Light not working.",
        category: "other",
        status: "in_progress",
        severity: "medium",
        assignedOfficerId: officer2._id.toString(),
        address: "Crossroad",
        location: { type: "Point", coordinates: [106.665, 10.845] },
        isDeleted: false,
      },
      {
        citizenId: citizen5._id.toString(),
        title: "Stray Dogs",
        description: "Pack of aggressive dogs.",
        category: "other",
        status: "resolved",
        severity: "low",
        assignedOfficerId: officer1._id.toString(),
        address: "Park B",
        location: { type: "Point", coordinates: [106.625, 10.855] },
        isDeleted: false,
      },
      {
        citizenId: citizen1._id.toString(),
        title: "Fire at warehouse",
        description: "Smoke coming out.",
        category: "air_pollution",
        status: "closed",
        severity: "critical",
        assignedOfficerId: officer2._id.toString(),
        address: "Warehouse C",
        location: { type: "Point", coordinates: [106.615, 10.805] },
        isDeleted: false,
      },
      {
        citizenId: citizen2._id.toString(),
        title: "Chemical barrels",
        description: "Abandoned barrels.",
        category: "illegal_dumping",
        status: "pending",
        severity: "high",
        address: "Highway 2",
        location: { type: "Point", coordinates: [106.675, 10.865] },
        isDeleted: false,
      },
      {
        citizenId: citizen3._id.toString(),
        title: "Overflowing Bin",
        description: "Trash bin is full.",
        category: "illegal_dumping",
        status: "pending",
        severity: "low",
        address: "Alley 3",
        location: { type: "Point", coordinates: [106.685, 10.875] },
        isDeleted: false,
      },
      {
        citizenId: citizen4._id.toString(),
        title: "Bridge Damage",
        description: "Cracks on bridge.",
        category: "other",
        status: "verified",
        severity: "critical",
        address: "Bridge D",
        location: { type: "Point", coordinates: [106.695, 10.885] },
        isDeleted: false,
      },
      {
        citizenId: citizen5._id.toString(),
        title: "Loud Music Party",
        description: "Late night noise.",
        category: "noise_pollution",
        status: "pending",
        severity: "low",
        address: "Building G",
        location: { type: "Point", coordinates: [106.605, 10.795] },
        isDeleted: false,
      },
    ];

    const alerts = await Alert.insertMany(alertsData);

    const locationsData = alerts.map((a) => ({
      alertId: a._id.toString(),
      category: a.category,
      severity: a.severity,
      status: a.status,
      location: a.location,
      isDeleted: false,
    }));

    await Location.insertMany(locationsData);

    console.log("Seeding Service Areas...");
    await ServiceArea.insertMany([
      {
        code: "Q01-PBN",
        name: "Phường Bến Nghé - Quận 1",
        administrativeLevel: "WARD",
        parentCode: "DISTRICT-01",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [106.698, 10.778],
              [106.708, 10.785],
              [106.712, 10.776],
              [106.702, 10.771],
              [106.698, 10.778],
            ],
          ],
        },
        assignedOfficerIds: [officer1._id.toString(), officer2._id.toString()],
        isActive: true,
        priority: 10,
        isDeleted: false,
      },
      {
        code: "QGV-P04",
        name: "Phường 4 - Quận Gò Vấp",
        administrativeLevel: "WARD",
        parentCode: "DISTRICT-GV",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [106.68, 10.82],
              [106.69, 10.825],
              [106.695, 10.815],
              [106.685, 10.81],
              [106.68, 10.82],
            ],
          ],
        },
        assignedOfficerIds: [officer1._id.toString()],
        isActive: true,
        priority: 8,
        isDeleted: false,
      },
      {
        code: "QBT-P25",
        name: "Phường 25 - Quận Bình Thạnh",
        administrativeLevel: "WARD",
        parentCode: "DISTRICT-BT",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [106.71, 10.805],
              [106.722, 10.81],
              [106.725, 10.8],
              [106.713, 10.795],
              [106.71, 10.805],
            ],
          ],
        },
        assignedOfficerIds: [officer2._id.toString()],
        isActive: true,
        priority: 9,
        isDeleted: false,
      },
    ]);

    console.log("Seeding Complete!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding Error:", error);
    process.exit(1);
  }
}

seed();
