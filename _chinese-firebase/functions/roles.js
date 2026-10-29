const {owner}=require('./validation');
const {HttpsError}=require('firebase-functions/v2/https');
function roles(auth,assigned=false){
 const admin=!!auth&&owner(auth.token);
 const teacher=!!auth&&!admin&&assigned&&(auth.token.email_verified===true||auth.uid==='shared-teacher');
 return {admin,teacher,canTeach:admin||teacher,role:admin?'admin':teacher?'teacher':'student'};
}
function authorize(action,access){
 const technical=['setAdmin','setRole','saveMail','setMail','sharedLogin','saveProvider','setProvider','listFeedback','getFeedback','setFeedbackStatus'];
 if(technical.includes(action)&&!access.admin)throw new HttpsError('permission-denied','Only the administrator can use this feature.');
 if(['saveLesson','listUsers','setModules','getCoachSettings','saveCoachSettings','assignLessonCoach','previewCoach'].includes(action)&&!access.canTeach)throw new HttpsError('permission-denied','Teacher access is required.');
}
module.exports={roles,authorize};
