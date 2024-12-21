const express = require('express');
const app = express();
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cors = require('cors');

const port = process.env.PORT || 5000;
// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eee6g.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const productsCollection = client.db("mobile-shop-db").collection("products");
        const testimonialsCollection = client.db("mobile-shop-db").collection("Testimonials")
        const categoriesCollection = client.db("mobile-shop-db").collection("categories")
        const userCollection = client.db("mobile-shop-db").collection("users")
        const cartCollection = client.db("mobile-shop-db").collection("cart")
        const wishListCollection = client.db("mobile-shop-db").collection("wishList")
        // jwt related api
        app.post('/jwt', async (req, res) => {
            const { email } = req.body
            const query = { email: email }
            const user = await userCollection.findOne(query)
            if (!user) return "Invalid! User not present"
            const userEmail = req.body;
            const token = jwt.sign(userEmail, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token, _id: user._id, name: user.name, role: user.role, email: user.email });
        })
        // middlewares 
        const verifyToken = (req, res, next) => {
            // console.log('inside verify token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }

        // use verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }
        // use verify admin after verifyToken
        const verifyUser = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isUser = user?.role === 'buyer';
            if (!isUser) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }
        // use verify seller after verifyToken
        const verifySeller = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isSeller = user?.role === 'seller';
            if (!isSeller) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }
        // users related api
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'seller'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })
        app.delete('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(filter);
            res.send(result);
        })

        app.get('/user/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            try {
                const query = { email: email }
                const existingUser = await userCollection.findOne(query);
                res.send(existingUser)
            } catch (error) {
                console.log(error)
            }
        })
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });
        // products related apis
        app.get('/products', async (req, res) => {
            try {
                const result = await productsCollection.find().toArray();
                res.send(result);
            } catch (error) {
                console.log(error)
            }
        });
        // Update product by ID
        app.patch("/productDetails/:id", async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    name: item.name,
                    description: item.description,
                    price: item.price,
                    category: item.category,
                    brand: item.brand,
                    image: item.image,
                    featured: item.featured
                }
            }

            const result = await productsCollection.updateOne(filter, updatedDoc)
            res.send(result);
        });


        app.get('/products/:email', async (req, res) => {
            try {
                const email = req.params.email
                const query = { addedBy: email }
                const result = await productsCollection.find(query).toArray()
                res.send(result)
            } catch (error) {
                console.error("Failed to add product item:", error);
                res.status(500).json({ message: "Failed to get products" });
            }
        })
        app.post('/product', async (req, res) => {
            try {
                const product = req.body
                const result = await productsCollection.insertOne(product)
                res.send(result)
            } catch (error) {
                console.error("Failed to add product item:", error);
                res.status(500).json({ message: "Failed to add product Item" });
            }
        })
        app.get('/productDetails/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            try {
                const product = await productsCollection.findOne(query)
                res.send(product)
            } catch (error) {
                console.error("Failed to get product item:", error);
                res.status(500).json({ message: "Failed to get product Item" });
            }

        })
        app.delete('/product/:id', verifyToken, verifySeller, async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };

                // Perform the delete operation
                const result = await productsCollection.deleteOne(query);


                // Successful deletion response
                res.send(result);
            } catch (error) {
                console.error("Error deleting product item:", error);
                res.status(500).json({ message: "Failed to delete product item" });
            }
        });
        // cart related apis
        app.post("/cart", verifyToken, verifyUser, async (req, res) => {
            const cartItem = req.body;

            try {
                const result = await cartCollection.insertOne(cartItem);
                res.send(result);
            } catch (error) {
                console.error("Failed to insert cart item:", error);
                res.status(500).json({ message: "Failed to add to cart" });
            }
        })
        app.get('/cart/:id', verifyToken, verifyUser, async (req, res) => {
            try {
                const id = req.params.id;

                // Assuming `id` refers to a field other than `_id` or is used for multiple documents
                const query = { userId: id }; // Adjust field name as needed (e.g., `userId`)

                // Fetch all matching documents
                const result = await cartCollection.find(query).toArray();

                // if (result.length === 0) {
                //     return res.status(404).json({ message: "No cart items found for this user" });
                // }

                res.send(result); // Send all matching documents
            } catch (error) {
                console.error("Error fetching cart items:", error);
                res.status(500).json({ message: "Failed to get cart items" });
            }
        });
        app.delete('/cart/:id', verifyToken, verifyUser, async (req, res) => {
            try {
                const id = req.params.id;


                const query = { _id: new ObjectId(id) };

                // Perform the delete operation
                const result = await cartCollection.deleteOne(query);


                // Successful deletion response
                res.send(result);
            } catch (error) {
                console.error("Error deleting cart item:", error);
                res.status(500).json({ message: "Failed to delete cart item" });
            }
        });


        // wishList related apis
        // POST /wishlist
        app.post("/wishlist", verifyToken, verifyUser, async (req, res) => {
            const { userId, productId } = req.body;

            try {
                // Check if the item already exists in the wishlist
                const existingItem = await wishListCollection.findOne({
                    userId,
                    productId,
                });

                if (existingItem) {
                    return res.status(400).json({ message: "Item already exists in wishlist" });
                }

                // Add the new item to the wishlist
                const result = await wishListCollection.insertOne(req.body);

                if (result.insertedId) {
                    res.status(201).json({ insertedId: result.insertedId, message: "Item added to wishlist" });
                } else {
                    res.status(500).json({ message: "Failed to add item to wishlist" });
                }
            } catch (error) {
                console.error("Error adding item to wishlist:", error);
                res.status(500).json({ message: "Internal Server Error" });
            }
        });
        app.get('/wishList/:id', verifyToken, verifyUser, async (req, res) => {
            try {
                const id = req.params.id;

                // Assuming `id` refers to a field other than `_id` or is used for multiple documents
                const query = { userId: id }; // Adjust field name as needed (e.g., `userId`)

                // Fetch all matching documents
                const result = await wishListCollection.find(query).toArray();



                res.send(result); // Send all matching documents
            } catch (error) {
                console.error("Error fetching wishList items:", error);
                res.status(500).json({ message: "Failed to get wishList items" });
            }
        });
        app.delete('/wishList/:id', verifyToken, verifyUser, async (req, res) => {
            try {
                const id = req.params.id;
                console.log(id)
                console.log('Hello from wish')
                const query = { _id: new ObjectId(id) };

                // Perform the delete operation
                const result = await wishListCollection.deleteOne(query);


                // Successful deletion response
                res.send(result);
            } catch (error) {
                console.error("Error deleting cart item:", error);
                res.status(500).json({ message: "Failed to delete wishList item" });
            }
        });
        // testmonials related apis
        app.get('/testimonials', async (req, res) => {
            try {
                const result = await testimonialsCollection.find().toArray();
                res.send(result);
            } catch (error) {
                console.log(error)
            }
        });
        // categories related apis
        app.get('/categories', async (req, res) => {
            try {
                const result = await categoriesCollection.find().toArray();
                res.send(result);
            } catch (error) {
                console.log(error)
            }
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Mobie Shop')
})

app.listen(port, () => {
    console.log(`Mobile shop is running on port ${port}`);
})
