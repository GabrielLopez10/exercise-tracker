require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Schema } = mongoose;
const app = express();
const mySecret = process.env['MONGO_URI']

app.use(cors());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }))
app.use(express.json()); // Add this line to parse JSON in request bodies
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// Connect to MongoDB
mongoose.connect(mySecret, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});


const exerciseSchema = new Schema({
  user_id: { type: String, required: true },
  description: String,
  duration: Number,
  date: Date,
});

const Exercise = mongoose.model('Exercise', exerciseSchema);

const userSchema = new Schema({
  username: String,
  log: [{ type: Schema.Types.ObjectId, ref: 'Exercise' }],
});

const User = mongoose.model('User', userSchema);

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}).select("_id username");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users', async (req, res) => {
  const { username } = req.body;

  try {
    const newUser = new User({ username });
    const savedUser = await newUser.save();

    res.json({ username: savedUser.username, _id: savedUser._id });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users/:_id/exercises', async (req, res) => {
  const { _id } = req.params;
  const { description, duration, date } = req.body;

  try {
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newExercise = new Exercise({
      user_id: user._id,
      description,
      duration,
      date: date ? new Date(date) : new Date(),
    });

    await newExercise.save();

    user.log.push(newExercise);
    await user.save();

    res.json({
      _id: user._id,
      username: user.username,
      description: newExercise.description,
      duration: newExercise.duration,
      date: new Date(newExercise.date).toDateString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/users/:_id/logs', async (req, res) => {
  const { _id } = req.params;
  const { from, to, limit } = req.query;

  try {
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let filter = { user_id: _id };

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    let exercises = await Exercise.find(filter)
      .limit(+limit ?? 500)
      .select('description duration date -_id');

    exercises = exercises.map(exercise => ({
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString(),
    }));

    res.json({
      username: user.username,
      count: exercises.length,
      _id: user._id,
      log: exercises,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
