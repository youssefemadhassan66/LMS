import AppErrorHelper from "../Utilities/AppErrorHelper";
import ExternalCourse from '../Models/ExternalCourse.js'
import mongoose from "mongoose";
import ApiFeatures from "../Utilities/ApiFeatures.js";


const CreateExternalCourse = async(data)=>{

    const {teacher,subject,createdBy,student,color} = {...data};
    

      const studentData = await User.findById(student);
     
    
      if (!studentData) {
        throw new AppErrorHelper("User not found!", 404);
      }
    
    
      if (studentData.role !== "student" ) {
        throw new AppErrorHelper("Wrong assignment of roles!", 400);
      }

    

    return await ExternalCourse.create({
        teacher:teacher,
        subject:subject,
        createdBy:createdBy,
        student:student,
        color:color
    });


}

const getAllExternalCoursesService = async(queryString={}) =>{
        
     const features = new ApiFeatures(ExternalCourse.find({}),queryString)
    .filter()
    .sort()
    .fields()
    .pagination()

    return features.mongooseQuery;

} 

const getExternalCourseByIdService  = async(exCourseId) =>{
    
    const exCourse = ExternalCourse.findById(exCourseId);

    if(!exCourse){
        throw new AppErrorHelper("Course not found ! ", 404);
    }
    return exCourse;


}
const getExternalCourseByStudentService = async (studentId, queryString = {}) => {
    const features = new ApiFeatures(
        ExternalCourse.find({ studentId }), 
        queryString
    ).sort().fields().pagination();
    return await features.mongooseQuery;
}

const updateExternalService = async(exCourseId,data) =>{

    const options = {
        new:true,
        runValidators:true
    }

    const exCourse = await ExternalCourse.findByIdAndUpdate(exCourseId,data,options)

    if(!exCourse){
        throw new AppErrorHelper("Course not found ! ", 404);
    }

    return exCourse

}

