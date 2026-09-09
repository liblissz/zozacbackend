import mongoose from 'mongoose';

export const connectDatabase = async () => {
    try {
        await mongoose.connect(process.env.ALTLASURI);
        console.log('database connected successfully');
    } catch (error) {
        console.error('database connection failed:', error);
        throw error;
    }
};

export { mongoose };
