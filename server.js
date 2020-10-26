var express = require('express');
var app = express();
var router = express.Router();
var path = require('path');
    
var formidable = require('express-formidable');
app.use(formidable());

//insert db
var mongodb = require('mongodb');
var mongoClient = mongodb.MongoClient;
var ObjectId = mongodb.ObjectId;

var http = require('http').createServer(app);
var bcrypt = require('bcrypt');
var fileSystem = require('fs');
var jwt = require('jsonwebtoken');
var accessTokenSecret = 'myAccessTokenSecret123';

app.use(express.static('public'));
app.use('/css', express.static(__dirname + 'public/css'));
app.use('/img', express.static(__dirname + 'public/img'));
app.use('/js', express.static(__dirname + 'public/js'));
app.use(express.urlencoded({ extended: false }));


//socket
var socketIO = require('socket.io')(http);
var socketID = "";
var users = [];

var mainURL = 'http://localhost:3000';

socketIO.on('connection', function (socket){
    console.log('user connected', socket.id);
    socketID = socket.id;
});


http.listen(3000, function(){
    console.log('server started');

    mongoClient.connect('mongodb+srv://abc123:abc123456@cluster0.pnmfu.mongodb.net/renote?retryWrites=true&w=majority', {useUnifiedTopology: true}, function(error, client){
        var database = client.db('rb');   
   
//MAIN PAGE --------------------------------------------------------------------------------
    	app.get('/',function(req,res){
  			res.sendFile(__dirname + '/views/main.html');
  		});

//LOGIN ---------------------------------------------------------------------------------
      app.get('/login',function(req,res){
        res.sendFile(__dirname + '/views/login.html');
      });

      app.post('/login', function(req, res){
            var username = req.fields.username;
            var password = req.fields.password;
            database.collection('users').findOne({
                "username": username
            }, function(error, user){
                if(user == null){
                    res.json({
                        "status": "error",
                        "message": "username does not exist"
                    })
                } else {
                    bcrypt.compare(password, user.password, function(error, isVerify){
                        if(isVerify){
                            var accessToken = jwt.sign({ username: username}, accessTokenSecret);
                            database.collection('users').findOneAndUpdate({
                                "username": username
                            }, {
                                $set: {
                                    "accessToken": accessToken
                                }
                            }, function(error, data){
                                res.json({
                                    "status": "success",
                                    "message": "Login Successfully",
                                    "accessToken": accessToken,
                                })
                            })
                        } else {
                            res.json({
                                "status": "error",
                                "message": "Password is not correct"
                            });
                        }
                    });
                }
            });
        });

//SIGNUP---------------------------------------------------------------------------------
      app.get('/signup',function(req,res){
        res.sendFile(__dirname + '/views/signup.html');
      });  

      app.post('/signup', function(req, res){
            var username = req.fields.username;
            var password = req.fields.password;

            database.collection('users').findOne({
                $or: [{
                    "username": username
                }]
            }, function(error, user){
                if(user == null){
                    bcrypt.hash(password, 10, function(error, hash){
                        database.collection('users').insertOne({
                            "username": username,
                            "password": hash,
                            "aboutMe": "",
                            "notifications": [],
                            "posts": []
                        }, function(error, data){
                            res.json({
                                "status": "success",
                                "message": "Signed up successfully"
                            });
                        })
                    })
                } else {
                    res.json({
                        "status": "error",
                        "message": "Username already exist."
                    });
                }
            })
        });





//CREATE STORY ------------------------------------------------------------------------
        app.get('/create',function(req,res){
        res.sendFile(__dirname + '/views/create.html');
      });

        app.post("/addPost", function(req, res){
            var accessToken = req.fields.accessToken;
            var title = req.fields.title;
            var caption = req.fields.caption;
            var createdAt = new Date().getTime();
            var _id = req.fields._id;

            database.collection('users').findOne({
                "accessToken": accessToken
            }, function(error, user){
                if (user == null){
                    res.json({
                        "status": "error",
                        "message": "User has been logged out"
                    })
                } else {

                    database.collection("posts").insertOne({
                        "title": title,
                        "caption": caption,
                        "createdAt": createdAt,
                        "likers": [],
                        "comments": [],
                        "user": {
                            "_id": user._id,
                            "username": user.username,
                        }
                    }, function(error, data){

                        database.collection("users").updateOne({
                            "accessToken": accessToken
                        }, {
                            $push: {
                                "posts": {
                                "_id": data.insertedId,
                                "title": title,
                                "caption": caption,
                                "createdAt": createdAt,
                                "likers": [],
                                "comments": [],
                                }                              
                            }
                        }, function(error, data){

                            res.json({
                                "status": "success",
                                "message": "Post uploaded."
                            })
                        })
                    })
                }
            })
        }) 





//LANDING PAGE  ---------------------------------------------------------------------------
        app.get('/landing',function(req,res){
        res.sendFile(__dirname + '/views/landing.html');
      });


//LOGOUT -------------------------------------------------------------------------------
        app.get("/logout", function(req, res){
            res.redirect("/login");
        });



// POST THREAD 
        app.get('/post',function(req,res){
        res.sendFile(__dirname + '/views/post.html');



// EDIT STORY -----------------------------------------------------------------------------
        app.put('/doEdit', function(req, res){

        })


// DELETE STORY -----------------------------------------------------------------------------
            app.delete('/doDelete', function (req,res){

            })
        });








//NEWSFEED -----------------------------------------------------------------------------------------------------------------------
        app.post("/getNewsfeed", function(req, res){
            var accessToken = req.fields.accessToken;
            database.collection("users").findOne({
                "accessToken": accessToken
            }, function(error, user){
                if(user == null){
                    res.json({
                        "status": "error",
                        "message": "User has been logged out"
                    });
                } else{

                    var ids = [];
                    ids.push(user._id);

                    database.collection("posts")
                    .find({
                        "user._id": {
                            $in: ids
                        }
                    })
                    .sort({
                        "createdAt": -1
                    })
                    .limit(5)
                    .toArray(function (error, data){

                        res.json({
                            "status": "success",
                            "message": "record has been fetched",
                            "data": data
                        })
                    })
                }
            })
        });


// TRIGGER LIKE/HEART THREAD  ---------------------------------------------------------------------------------------------------------------
        app.post("/toggleLikePost", function(req, res){

            var accessToken = req.fields.accessToken;
            var _id = req.fields._id;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function(error, user){
                if(user == null){
                    res.json({
                        "status": "error",
                        "message": "User has been logged out"
                    })
                } else{

                    database.collection("posts").findOne({
                        "_id": ObjectId(_id)
                    }, function(error, post){
                        if(post == null){
                            res.json({
                                "status": "error",
                                "message": "Post does not exist."
                            });
                        } else {

                            var isLiked = false;
                            for (var a = 0; a < post.likers.length; a++) {
                                var liker = post.likers[a];

                                if(liker._id.toString() == user._id.toString()){
                                    isLiked = true;
                                    break;
                                }
                            }

                            if(isLiked){
                                database.collection("posts").updateOne({
                                    "_id": ObjectId(_id)
                                }, {
                                    $pull: {
                                        "likers": {
                                            "_id": user._id,
                                        }
                                    }
                                }, function(error, data){

                                    database.collection("users").updateOne({
                                        $and: [{
                                            "_id": post.user._id
                                        }, {
                                            "posts._id": post._id
                                        }]
                                    }, {
                                        $pull: {
                                            "posts.$[].likers": {
                                                "_id": user._id,
                                            }
                                        }
                                    });

                                    res.json({
                                        "status": "unliked",
                                        "message": "Post has been unliked."
                                    });
                                });
                            } else {

//PROFILE AND NOTIFICATION ------------------------------------------------------------------------------
                                database.collection("users").updateOne({
                                    "_id": post.user._id
                                }, {
                                    $push: {
                                        "notifications": {
                                            "_id": ObjectId(),
                                            "content": user.username + " liked your story",
                                            "createdAt": new Date().getTime()
                                        }
                                    }
                                });

                                database.collection("posts").updateOne({
                                    "_id": ObjectId(_id)
                                }, {
                                    $push: {
                                        "likers": {
                                            "_id": user._id,
                                            "username": user.username,
                                            
                                        }
                                    }
                                }, function(error, data){

                                    database.collection("users").updateOne({
                                        $and: [{
                                            "_id": post.user._id
                                        }, {
                                            "posts._id": post._id
                                        }]
                                    }, {
                                        $push: {
                                            "posts.$[].likers": {
                                                "_id": user._id,
                                                "username": user.username,
                                            }
                                        }
                                    });

                                    res.json({
                                        "status": "success",
                                        "message": "story liked"
                                    });
                                })
                            }
                        }
                    })
                }
            })
        })

//POST COMMENT -----------------------------------------------------------------------------------------------------
        app.post("/postComment", function(req, res){

            var accessToken = req.fields.accessToken;
            var _id = req.fields._id;
            var comment = req.fields.comment;
            var createdAt = new Date().getTime();


            database.collection("users").findOne({
                "accessToken": accessToken
            }, function(error, user){
                if(user == null){
                    res.json({
                        "status": "error",
                        "message": "User has been logged out"
                    });
                } else {

                    database.collection("posts").findOne({
                        "_id": ObjectId(_id)
                    }, function (error, post){
                        if(post = null) {
                            res.json({
                                "status": "error",
                                "message": " Post does not exist"
                            });
                        } else {

                            var commentId = ObjectId();

                            database.collection("posts").updateOne({
                                "_id": ObjectId(_id)
                            }, {
                                $push: {
                                    "comments": {
                                        "_id": commentId,
                                        "user": {
                                            "_id": user._id,
                                            "name": user.USERname,
                                        },
                                        "comment": comment,
                                        "createdAt": createdAt,
                                        "replies": []
                                    }
                                }
                            }, function(error, data){

                                if(user._id.toString() != post.user._id.toString()){
                                    database.collection("users").updateOne({
                                        "_id": post.user._id
                                    }, {
                                        $push: {
                                            "notifications": {
                                                "_id": ObjectId(),
                                                "content": user.username + " commented on your story.",
                                                "createdAt": new Date().getTime()
                                            }
                                        }
                                    });
                                }


                                database.collection("users").updateOne({
                                    $and: [{
                                        "_id": post.user._id
                                    }, {
                                        "posts._id": post._id
                                    }]
                                }, {
                                    $push: {
                                        "posts.$[].comments": {
                                            "_id": commentId,
                                            "user": {
                                                "_id": user._id,
                                                "name": user.username,
                                            },
                                            "comment": comment,
                                            "createdAt": createdAt,
                                            "replies": []
                                        }
                                    }
                                });

                                res.json({
                                    "status": "success",
                                    "message": "Comment has been uploaded"
                                });
                            })
                        }
                    })
                }
            })
        })


//REPLY ------------------------------------------------------------------------------------------------
        app.post("/postReply", function(request, result){

            var accessToken = req.fields.accessToken;
            var postId = req.fields.postId;
            var commentId = req.fields.commentId;
            var reply = req.fields.reply;
            var createdAt = new Date().getTime();

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function(error, user){
                if(user == null){
                    res.json({
                        "status": "error",
                        "message": "User has been logged out"
                    });
                } else {

                    database.collection("posts").findOne({
                        "_id": ObjectId(postId)
                    }, function (error, post){
                        if(post = null) {
                            res.json({
                                "status": "error",
                                "message": " Post does not exist"
                            });
                        } else { 

                            var replyId = ObjectId();

                            database.collection("posts").updateOne({
                                $and: [{
                                    "_id": ObjectId(postId)
                                }, {
                                    "comments._id": ObjectId(commentId)
                                }]
                                
                            }, {
                                $push: {
                                    "comments.$.replies": {
                                        "_id": replyId,
                                        "user": {
                                            "_id": user._id,
                                            "username": user.username,
                                        },
                                        "reply": reply,
                                        "createdAt": createdAt,
                                    }
                                }
                            }, function (error, data) {

                                database.collection("users").updateOne({
                                    $and: [{
                                        "_id": post.user._id
                                    }, {
                                        "posts._id": post._id
                                    }, {
                                        "posts.comments._id": ObjectId(commentId)
                                    }]
                                }, {
                                    $push: {
                                        "posts.$[].comments.$[].replies": {
                                            "_id": replyId,
                                            "user": {
                                                "_id": user._id,
                                                "username": user.username,
                                            },
                                            "reply": reply,
                                            "createdAt": createdAt
                                        }
                                    }
                                });

                                res.json({
                                    "status": "success",
                                    "message": "Reply has been posted"
                                });
                            });
                        }
                    });
                }
            });
        });

	});
});