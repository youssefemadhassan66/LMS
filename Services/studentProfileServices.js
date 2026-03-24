import StudentProfile from "../Models/studentProfile";
import User from "../Models/User";
import AppErrorHelper from "../Utilities/AppErrorHelper";


// StudentProfileServices.js
export const createStudentProfileService = async (userId, profileData) => {
  // Validate data
  if(!userId || !profileData){
    throw new AppErrorHelper("Student information is missing ! ", 404);
  }

  // Destructure profileData
  const { parents, grade, notes } = profileData;

  // Check user exists
  const user = await User.findById(userId);
  if(!user || !user.isActive){
    throw new AppErrorHelper("User not found ! ", 404);
  }

  // Create profile with relationships
  const studentProfile = await StudentProfile.create({
    user: user._id,
    parents: parents || [],
    grade: grade || '',
    notes: notes || ''
  });

  return studentProfile;
}

 const updateStudentProfileService = async (profileId, updateData) => {

    if(!profileId || !updateData){
        throw new AppErrorHelper("Profile ID and update data are required ! ", 400);
    }
    const options = {
        new:true,
        runValidators:true,
    }
    const updatedStudentProfile = await StudentProfile.findByIdAndUpdate(profileId,updateData,options)

    if(!updatedStudentProfile){
        
        throw new AppErrorHelper("Student profile not found ! ", 404);
    }

    return updatedStudentProfile;

}


 const getStudentProfileService = async (profileId) => {
  if(!profileId){
    throw new AppErrorHelper("Profile ID is required ! ", 400);
  }

  const profile = await StudentProfile.findById(profileId)
    .populate('user')
    .populate('parents');


  return profile;
}

export {
    getStudentProfileService,
    updateStudentProfileService,
    createStudentProfileService
}