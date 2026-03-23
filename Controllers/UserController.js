import CatchAsync from '../Utilities/CatchAsync.js';
import AppErrorHelper from '../Utilities/AppErrorHelper.js';
import User from '../Models/User.js';
import {   
    getAllUsersHelper,
    getUserByIDHelper,
    UpdateUserByIDHelper,
    SoftDeleteUserByIDHelper,
    getMyStudentsHelper,
    createUserHelper
} from "../Services/UserServices.js";

const getAllUsersController = CatchAsync(async(req,res,next)=>{
    const query = req.query
    const docs = await getAllUsersHelper(query);
    if(docs.length === 0 || !docs){
        return next(new AppErrorHelper("No documents found !",404));
    }
     res.status(200).json({
        status: 'success',
        data: { 
            results: docs.length,
            users: docs
         }
    });
    
})


const getUserController = CatchAsync(async (req, res, next) => {

    const user = await getUserByIDHelper(req.params.id);

    if (!user) {
        return next(new AppErrorHelper("User not found", 404));
    }

    res.status(200).json({
        status: "success",
        data: user
    });
});

const UpdateUserController = CatchAsync(async (req, res, next) => {

    const user = await UpdateUserByIDHelper(req.params.id,req.body);

    if (!user) {
        return next(new AppErrorHelper("User not found", 404));
    }

    res.status(200).json({
        status: "success",
        data: user
    });
});


const DeleteUserController = CatchAsync(async (req, res, next) => {

    const user = await SoftDeleteUserByIDHelper(req.params.id);

    if (!user) {
        return next(new AppErrorHelper("User not found", 404));
    }

    res.status(200).json({
        status: "success",
        message:"User deleted successfully !"
    });
});

const getMyStudentsController = CatchAsync(async (req,res,next)=>{
    
    const parentId = req.params.id

    const students = getMyStudentsHelper(parentId);

    if(students.length === 0 || !students){
        return next(new AppErrorHelper("No documents found !",404));
    }

    res.status(200).json({
        status: "success",
        data: students
    });

})  


const createUserController = CatchAsync(async (req, res, next) => {

    const user = await createUserHelper(req.body);

    if (!user) {
        return next(new AppErrorHelper("User creation failed", 400));
    }

    res.status(201).json({
        status: "success",
        data: user
    });
});






export {getAllUsersController,
    createUserController,
    getUserController,
    UpdateUserController,
    DeleteUserController,
    getMyStudentsController
}