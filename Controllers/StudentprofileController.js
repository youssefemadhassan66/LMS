import CatchAsync from '../Utilities/CatchAsync.js'
import AppErrorHelper from '../Utilities/AppErrorHelper.js';
import {
    getStudentProfileService,
    updateStudentProfileService,
    createStudentProfileService,
    getMyStudentProfileService,
    getMyStudentProfileServiceById,
    getAllStudentProfilesService
} from '../Services/studentProfileServices.js'


const getMyStudentProfileController = CatchAsync(async (req,res,next)=>{
    const user = req.user;
    

    if(!user){
        return next(new AppErrorHelper("User not found", 404));
    }

    const profiles = await getMyStudentProfileService(user);

    res.status(200).json({
        status: "success",
        data: profiles
    });
     
});
const  getMyStudentProfileByIdController = CatchAsync(async (req,res,next)=>{
    const profile = await getMyStudentProfileServiceById(req.user,req.params.id);
    if(!profile){
        return next(new AppErrorHelper("Profile not found", 404));
    }
    res.status(200).json({
        status: "success",
        data: profile
    });

})

const getAllStudentProfileController = CatchAsync(async (req,res,next)=>{
    
    const profiles = await getAllStudentProfilesService(req.query);

    if(profiles.length === 0 ){
        return next(new AppErrorHelper("No profiles found!", 404));
    }

    
    res.status(200).json({
        status: "success",
        result:profiles.length,
        data: {profiles}
    });


})

const updateStudentProfileController = CatchAsync(async(req,res,next)=>{

    const StudentProfile = await updateStudentProfileService(req.params.id, req.body); 

    res.status(200).json({
        status: "success",
        data: StudentProfile
    });

})

const createStudentProfileController = CatchAsync(async(req,res,next)=>{

    const StudentProfile = await createStudentProfileService(req.params.id, req.body); 

    res.status(201).json({
        status: "success",
        data: StudentProfile
    });

})

const getStudentProfileController = CatchAsync(async(req,res,next)=>{

    const StudentProfile = await getStudentProfileService(req.params.id); 


    if (!StudentProfile) {
        return next(new AppErrorHelper("User not found", 404));
    }

    res.status(200).json({
        status: "success",
        data: StudentProfile
    });


})


export {
    getStudentProfileController,
    updateStudentProfileController,
    createStudentProfileController,
    getMyStudentProfileController,
    getMyStudentProfileByIdController,
    getAllStudentProfileController
}