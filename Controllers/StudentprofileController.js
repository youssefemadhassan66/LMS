import CatchAsync from '../Utilities/CatchAsync.js'
import AppErrorHelper from '../Utilities/AppErrorHelper.js';
import {
     getStudentProfileService,
    updateStudentProfileService,
    createStudentProfileService
} from '../Services/studentProfileServices.js'








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
}