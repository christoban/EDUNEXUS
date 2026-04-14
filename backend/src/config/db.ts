import mongoose from "mongoose";

// Connect our db
export const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URL as string);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
    }
};
