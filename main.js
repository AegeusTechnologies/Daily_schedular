const express = require('express');
const dailySchedularRouter = require('./schedular_Routes.js/schedular');
const app = express();
PORT = process.env.PORT;

app.use(express.json());

app.use('api/v1/schedular',dailySchedularRouter)

app.listen(PORT, () =>{
    console.log(`Server is running on port ${PORT}`);
})




