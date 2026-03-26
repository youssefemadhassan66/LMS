import Session from "../Models/Session.js";
import User from "../Models/User.js";
import AppErrorHelper from "../Utilities/AppErrorHelper.js";
import ApiFeatures from "../Utilities/ApiFeatures.js";

const createSessionService = async (data)=>{   
    
    const {
        title, 
        description,
        recapVideoLinks,
        attachmentsLinks,
        studentId,
        instructorId, 
        date,
        StudentAttended,
    } = data
    
    // check on instructor and student id 

    const student = await User.findById(studentId)
    const instructor = await User.findById(instructorId)

    if(!student || !instructor){
        throw new AppErrorHelper(" User not found  ! ", 404);
    }

    return await Session.create({
        title:title, 
        description:description,
        recapVideoLinks:recapVideoLinks || [],
        attachmentsLinks:attachmentsLinks || [],
        studentId:student._id,
        instructorId:instructor._id, 
        date:date,
        StudentAttended:StudentAttended ?? true,
    })
}

const getSessionByIdService = async (SessionId) => {
    
    const session = await Session.findById(SessionId);
    if(!session){
        throw new AppErrorHelper("Session not found  ! ", 404);
    }
    return session
}



const getAllSessionsService = async (queryString) => {
    const features = new ApiFeatures(
        Session.find({}), 
        queryString
    ).filter().sort().fields().pagination();

    const sessions = await features.mongooseQuery;
    return sessions;
}

const getSessionsByStudentService = async (studentId, queryString = {}) => {
    const features = new ApiFeatures(
        Session.find({ studentId }), 
        queryString
    ).sort().fields().pagination();
    return await features.mongooseQuery;
}

const getSessionsByInstructorService = async (instructorId, queryString = {}) => {
    const features = new ApiFeatures(
        Session.find({ instructorId }), 
        queryString
    ).sort().fields().pagination();
    return await features.mongooseQuery;
}


const UpdateSessionByIdService = async (SessionId,data) => {
    const options = {
        new:true,
        runValidators:true,
    }
    const session = await Session.findByIdAndUpdate(SessionId,data,options);

    if(!session){
        throw new AppErrorHelper("Session not found ! ", 404);
    }

    return session
}


const deleteSessionByIdService = async (SessionId) => {
    
    const session = await Session.findByIdAndDelete(SessionId);
    
    if(!session){
        throw new AppErrorHelper("Session not found!", 404);
    }
    return session;
}

export {
    createSessionService,
    getAllSessionsService,
    getSessionsByInstructorService,
    getSessionByIdService,
    getSessionsByStudentService,
    UpdateSessionByIdService,
    deleteSessionByIdService
}