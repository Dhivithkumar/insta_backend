const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt")

const port = 3000;
const app = express();

app.use(cors());
app.use(express.json());

const mongoUrl = "mongodb+srv://dhivithkumar:dhivith123@cluster0.e9hsyh7.mongodb.net/Instagram";

mongoose.connect(mongoUrl)
    .then(() => console.log("✅ DB connected successfully!"))
    .catch((err) => console.error("❌ DB connection error:", err));

// Start the server only if DB connection is successful
mongoose.connection.once("open", () => {
    app.listen(port, () => {
        console.log(`🚀 Server is running on http://localhost:${port}`);
    });
});

// Post Schema
const postSchema = new mongoose.Schema(
    {
        username: { type: String, required: true },
        profileImage: { type: String, required: false },
        caption: { type: String, required: true },
        image: { type: String, required: true },
    },
    { timestamps: true }
);

const Post = mongoose.model("Post", postSchema);

// Create Post Endpoint
app.post("/createPost", async (req, res) => {
    try {
        const { username, profileImage, caption, image } = req.body;

        if (!username || !profileImage || !caption || !image) {
            return res.status(400).json({ error: "All fields are required!" });
        }

        const newPost = new Post({ username, profileImage, caption, image });
        await newPost.save();

        res.status(201).json({ message: "Post created successfully!" });
    } catch (error) {
        console.error("Post creation error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// Get All Posts Endpoint
app.get("/getPosts", async (req, res) => {
    try {
        const posts = await Post.find();
        res.status(200).json(posts);
    } catch (err) {
        console.error("❌ Error fetching posts:", err);
        res.status(500).json({ message: "Internal Server Error", error: err.message });
    }
});

//user Register 

const userSchema =  new mongoose.Schema({
    email:{type:String , required :true,unique :true},
    fullname:{type:String , required :true,},
    username:{type:String , required :true,unique :true},
    password:{type:String , required :true,},
})

const user = mongoose.model("user",userSchema);

app.post("/userReg",async (req ,res ) => { 
    const { email ,fullname ,username ,password } =req.body;
    const hashedPassword = await bcrypt.hash(password ,10);
    const newUser = new user({email,fullname,username,password : hashedPassword});
    const savedUser = await  newUser.save();
    res.status(200).json({message : "user registered successfully ", user:savedUser});
});


//user login  

app.post("/userlogin", async (req, res) => {
    const { username, password } = req.body;
    const userdata = await user.findOne({ username });

    if (!userdata) {
        return res.status(404).json({ message: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(password, userdata.password);
    if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ username: userdata.username }, "my-key");

    res.status(200).json({ 
        message: "Login successful", 
        token, 
        username: userdata.username 
    });
});

  //username 
  app.get("/getUser", (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
    }
    res.json({ username: req.user.username });
});

 //Authorize

 const Authorize = (req, res, next) => {
    const token = req.headers['authorization'].split(" ")[1];
    console.log("Token 💠:",token)
    if(!token) {
      return res.status(403).json({ message : "No token provided." });
    }
  
    jwt.verify(token, "my-key", (err, userInfo)=>{
      if(err) {
        return res.status(401).json({ message : "Unauthorized" });
      }
      req.User = userInfo;
      next();
    });
  };
  
  app.get("/api/secured",Authorize, (req, res)=> {
    res.json({ message:"Access granted",user:req.User });
  });

  //suggest
  app.get("/suggest", async (req, res) => {
    try {
        const suggestedUsers = await user.find({}, "username profileImage"); 
        res.status(200).json(suggestedUsers);
    } catch (err) {
        console.error("Error fetching suggested users:", err);
        res.status(500).json({ message: "Server error: " + err.message });
    }
});




const profileSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    profileName: { type: String, required: true },
    bio: { type: String },
    profileImage: { type: String, default: "default-profile.png" },
    followers: { type: Number, default: 0 },
    following: { type: Number, default: 0 },
});




const Profile = mongoose.model("Profile", profileSchema);

app.get('/getting/:username', async (req, res) => {
    const { username } = req.params;
    console.log("Received username:", username);

    if (!username) {
        return res.status(400).json({ error: "Username is required" });
    }

    try {
        const user = await Profile.findOne({ username: username });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        res.status(200).json(user);
    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

  // Route to update user profile
  const updatePostProfileImage = async (username, profileImage) => {
    try {
        await Post.updateMany(
            { username: username }, // Find posts by the username
            { $set: { profileImage: profileImage } } // Update profileImage in posts
        );
        console.log(`Updated profileImage in Posts for ${username}`);
    } catch (error) {
        console.error("Error updating profile image in Posts:", error);
    }
};

app.put("/update", async (req, res) => {
    const { username, profileName, bio, profileImage } = req.body;

    if (!username) {
        return res.status(400).json({ error: "Username is required" });
    }

    try {
        let user = await Profile.findOne({ username: username });

        if (!user) {
            // If user doesn't exist, create a new profile
            user = new Profile({
                username,
                profileName: profileName || "New User",
                bio: bio || "No bio available",
                profileImage: profileImage || "https://example.com/default-profile.jpg",
                followers: 0,
                following: 0,
            });
            await user.save();
            return res.status(201).json({ message: "New profile created successfully", user });
        }

        // Update Profile collection
        user.profileName = profileName || user.profileName;
        user.bio = bio || user.bio;
        user.profileImage = profileImage || user.profileImage;
        await user.save();

        // If profileImage is provided, update posts with the new profile image
        if (profileImage) {
            await updatePostProfileImage(username, profileImage); // Update the profile image in posts
        }

        res.status(200).json({ message: "Profile updated successfully", user });
    } catch (err) {
        console.error("Error updating profile:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
