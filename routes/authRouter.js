import express from 'express';
import { connectToDatabase } from '../database/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';


const router = express.Router();

const db = await connectToDatabase();
if(db !== null){
    console.log("Connected to the database");
}

// Registration route
router.post('/register', async (req, res) => {
    const { username, password, confirm_password } = req.body;

    // Check if all fields are provided
    if (!username || !password || !confirm_password) {
        return res.status(201).json({ message: 'Please fill in all fields' });
    }

    // Check if passwords match
    if (password !== confirm_password) {
        return res.status(202).json({ message: 'Passwords do not match' });
    }

    try {
        // Check if username already exists
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length > 0) {
            return res.status(203).json({ message: 'User already exists' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user into the database
        await db.query('INSERT INTO users (username, pwd) VALUES (?, ?)', [username, hashedPassword]);

        return res.status(200).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Error registering user:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// Login route
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    console.log(username, password);

    // Check if all fields are provided
    if (!username || !password) {
        return res.status(201).json({ message: 'Please fill in all fields' });
    }

    try {
        // Check if username exists
        const [user] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (user.length === 0) {
            return res.status(203).json({ message: 'User not found' });
        }

        // Compare passwords
        const isMatch = await bcrypt.compare(password, user[0].pwd);
        if (!isMatch) {
            return res.status(204).json({ message: 'Invalid password' });
        }

        console.log( 'authentication successful');

        // Generate JWT token (optional)
        const token = jwt.sign({ id: user[0].id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        console.log('Token:', token);
        return res.status(200).json({ token: token});

    } catch (error) {
        console.error('Error logging in:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

const authenticateToken = (req, res, next) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) {
            return res.status(402).json({ message: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.id;
        next();

    } catch (error) {
        console.error('Error authenticating token:', error);
        return res.status(401).json({ message: 'Unauthorized' });
        
    }
}

router.get('/prediction', authenticateToken, async (req, res) => {
    try {
   
        // Fetch user data from the database
        const [user] = await db.query('SELECT * FROM users WHERE id = ?', [req.user]);
        if (user.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const [prediction] = await db.query('SELECT * FROM prediction')
        if (prediction.length === 0) {
            return res.status(205).json({ message: 'no prediction available, be the first to predict today!!!' });
        }

        return res.status(200).json(
            {
                "user": user[0] ,
                "prediction": [ prediction ],
            }
        );
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/prediction_form/:id', async (req, res) => {
    const user_id = req.params.id;
    const {country, home, away, outcome} = req.body;
    const today = new Date().toISOString().split('T')[0];
    // console.log(today);
    // console.log(country, home, away, outcome);
    // console.log(user_id);
    if (!user_id) {
        return res.status(213).json({ message: 'Login required' });
    }
    if (!country || !home || !away || !outcome) {
        return res.status(214).json({ message: 'Please fill in all fields' });
    }

    try{

    //     // Fetch prediction data from the database
        const [user] = await db.query('SELECT * FROM users WHERE id = ?', [user_id]);
        if (user.length === 0) {
            return res.status(212).json({ message: 'user not found' });
        } 
        // res.status(200).json({ message:'User found' });
        const { username } = user[0];
        console.log(username);
        
    //     // Fetch prediction data from the database
        const [prediction] = await db.query('SELECT COUNT(*) AS count FROM prediction WHERE user_ref = ? AND DATE(created_at) = ?', [user_id, today]);
        if (prediction[0].count >= 2) {
            return res.status(211).json({ message: 'you have reached your daily prediction limit' });
        }

    //     // Insert new prediction into the database
        const [result] = await db.query('INSERT INTO prediction (username, country, home, away, outcome, created_at, user_ref) VALUES (?, ?, ?, ?, ?, NOW(), ?)', [username, country, home, away, outcome, user_id]);
        if(result.length === 0 ){
            return res.status(210).json({ message: 'failed to submit prediction' });
        }
        // Fetch all predictions from the database
        const [allPredictions] = await db.query('SELECT * FROM prediction');
        console.log('prediction submitted successfully');
        // Send all predictions data to the client
        return res.status(201).json({ message: 'prediction submitted successfully', predictions: allPredictions });
        
        // return res.status(201).json({message: 'prediction submitted successfully'});
    }catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});


export default router;