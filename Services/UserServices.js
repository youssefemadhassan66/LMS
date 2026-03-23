import User from '../Models/User.js';
import ApiFeatures from '../Utilities/ApiFeatures.js';
import StudentProfile from '../Models/studentProfile.js';


// Admin only 
const getAllUsersHelper = async (query) => {
    const features = new ApiFeatures(User.find({}), query)
        .filter()
        .sort()
        .fields()
        .pagination();
    const users = await features.mongooseQuery;
     
    return users;
};

const getUserByIDHelper = async (id) =>{
    const user = await User.findById(id);
    return user;
}

const UpdateUserByIDHelper = async (id,data) =>{
   const options = {
        new: true,
        runValidators: true
    }
    const user = await User.findByIdAndUpdate(id,data,options);

    return user;

}
const SoftDeleteUserByIDHelper = async (id) =>{
    const user = await User.findByIdAndUpdate(
        id,
        {isActive:false},
        {new:true});
    return user;
}
const createUserHelper = async(data) =>{
    const user = await User.create(data)
    return user;
}


// parent 

const getMyStudentsHelper = async(parentID)=>{
    
    const students = StudentProfile.find({parents:parentID}).populate('user')
    
    return students;

}   


export{
    getAllUsersHelper,
    getUserByIDHelper,
    UpdateUserByIDHelper,
    SoftDeleteUserByIDHelper,
    createUserHelper,
    // Parent 
    getMyStudentsHelper
}




