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
    type AlertSeedTuple = [
      citizenIdx: number,
      title: string,
      description: string,
      category: string,
      status: string,
      severity: string,
      address: string,
      coordinates: [number, number],
      officerIdx?: number,
    ];

    const citizens = [citizen1, citizen2, citizen3, citizen4, citizen5];
    const officers = [officer1, officer2];

    const alertTuples: AlertSeedTuple[] = [
      [0, "Waste Dumping in Park", "Someone dumped trash.", "illegal_dumping", "pending", "medium", "Park A", [106.63, 10.82]],
      [1, "Fallen Tree on Road", "Tree blocking road.", "fallen_tree", "verified", "high", "Street B", [106.64, 10.83]],
      [2, "Flooded Street", "Water level high.", "flooding", "assigned", "high", "Street C", [106.65, 10.81], 0],
      [3, "Air Pollution from Factory", "Black smoke.", "air_pollution", "in_progress", "critical", "Factory Zone", [106.66, 10.84], 1],
      [4, "Water Pollution", "Chemical spill.", "water_pollution", "resolved", "critical", "River X", [106.62, 10.85], 0],
      [0, "Illegal Burning", "Burning trash.", "illegal_burning", "closed", "low", "Empty Lot", [106.61, 10.8], 1],
      [1, "Dead Animal", "Dead dog on road.", "wildlife_threat", "pending", "low", "Highway 1", [106.67, 10.86]],
      [2, "Blocked Drain", "Drain is clogged.", "flooding", "pending", "medium", "Alley 2", [106.68, 10.87]],
      [3, "Dangerous Infrastructure", "Broken electrical pole.", "other", "verified", "high", "Street D", [106.69, 10.88]],
      [4, "Noise Pollution", "Loud construction at night.", "noise_pollution", "pending", "low", "Building E", [106.6, 10.79]],
      [0, "Pothole on Main Street", "Huge pothole.", "other", "pending", "medium", "Main St", [106.635, 10.825]],
      [1, "Smell of Gas", "Strong gas smell.", "air_pollution", "verified", "critical", "Block F", [106.645, 10.835]],
      [2, "River Trash", "Plastics in river.", "water_pollution", "assigned", "high", "River Y", [106.655, 10.815], 0],
      [3, "Traffic light broken", "Light not working.", "other", "in_progress", "medium", "Crossroad", [106.665, 10.845], 1],
      [4, "Stray Dogs", "Pack of aggressive dogs.", "other", "resolved", "low", "Park B", [106.625, 10.855], 0],
      [0, "Fire at warehouse", "Smoke coming out.", "air_pollution", "closed", "critical", "Warehouse C", [106.615, 10.805], 1],
      [1, "Chemical barrels", "Abandoned barrels.", "illegal_dumping", "pending", "high", "Highway 2", [106.675, 10.865]],
      [2, "Overflowing Bin", "Trash bin is full.", "illegal_dumping", "pending", "low", "Alley 3", [106.685, 10.875]],
      [3, "Bridge Damage", "Cracks on bridge.", "other", "verified", "critical", "Bridge D", [106.695, 10.885]],
      [4, "Loud Music Party", "Late night noise.", "noise_pollution", "pending", "low", "Building G", [106.605, 10.795]],
    ];

    const alertsData = alertTuples.map(
      ([citizenIdx, title, description, category, status, severity, address, coordinates, officerIdx]) => ({
        citizenId: citizens[citizenIdx]._id.toString(),
        title,
        description,
        category,
        status,
        severity,
        ...(officerIdx !== undefined ? { assignedOfficerId: officers[officerIdx]._id.toString() } : {}),
        address,
        location: { type: "Point", coordinates },
        isDeleted: false,
      }),
    );

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
