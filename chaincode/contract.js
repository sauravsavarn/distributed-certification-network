'use strict';

const { Contract } = require('fabric-contract-api'); //import 'Contract' class from 'fabric-contract-api'

class CertnetContract extends Contract {

    constructor() {
        super("certnet"); //NOTE: as part of the chaincode class, it is required to call the constructor of Contract class,
        //      on which this class depends on, which expects 1 args which is name for this smart contract
        //      that we want the fabric network to recognize it by. This also forms the primary domain with
        //      which all of the other assets that is added inside of this smart contract are linked to, 
        //      which means that, if any point inside of this smart contract, if we define a function to
        //      create a new student asset or a certificate asset based on the business logic we are building,
        //      that student or certificate asset would get linked to the global domain name for this smart
        //      contract, which is now certnet here. You could think of this as the students or the certificate
        //      assets linked to or created from within this, smart contract class would be recognised on the
        //      network as certnet.student or certnet.certificates. This way of categorising various smart
        //      contracts that you define inside of the node.js project, which all come together as a single
        //      chaincode and put on a single channel, will make sure that you have proper distinction between
        //      the various assets and the keys that those assets are linked with, and make sure that there are
        //      no overlapping or collision of keys across multiple smart contracts and the multiple chaincodes
        //      which all get deployed on top of the same channel.  
    }

    //function to invoke as part of the deployment process.
    //1. invoke function just to return a simple message to the console, to give confirmation to the person who is deploying the
    //   smart contract that this contract or this nodejs project was successfully committed and deployed on top of the channel,
    //   which also signifies that if you are able to access this function while deployment, you will be able to access other smart
    //   contract function as well.
    async instantiate(ctx) {
        console.log("chaincode was successfully deployed");
    }

    //2. Create Student Asset
    async createStudent(ctx, studentId, name, email) {
        const studentKey = ctx.stub.createCompositeKey('certnet.student', [studentId]);
        const newStudentObject = {
            docType: 'student',
            studentId: studentId,
            name: name,
            email: email,
            school: ctx.clientIdentity.getID(),
            createdAt: ctx.stub.getTxTimestamp(),
            updatedAt: ctx.stub.getTxTimestamp()
        }
        const studentBuffer = Buffer.from(JSON.stringify(newStudentObject));
        // putState
        await ctx.stub.putState(studentKey, studentBuffer);
        return newStudentObject;
    }

    //3. Get Student
    async getStudent(ctx, studentId) {
        const studentKey = ctx.stub.createCompositeKey('certnet.student', [studentId]);
        const studentBuffer = await ctx.stub.getState(studentKey);
        if (studentBuffer) {
            return JSON.parse(studentBuffer.toString());
        } else {
            return 'Asset with key ' + studentId + ' does not exist on the network';
        }
    }

    //4. Issue Certificate Asset
    async issueCertificate(ctx, studentId, courseId, gradeReceived, originalHash) {
        let msgSender = ctx.clientIdentity.getID();
        let certificateKey = ctx.stub.createCompositeKey('certnet.certificate', [courseId, studentId]);
        let studentKey = ctx.stub.createCompositeKey('certnet.student', [studentId]);

        // Fetch student with given ID from blockchain
        let student = await ctx.stub
            .getState(studentKey)
            .catch(err => console.log(err));

        // Fetch certificate with given ID from blockchain
        let certificate = await ctx.stub
            .getState(certificateKey)
            .catch(err => console.log(err));

        // Make sure that student already exists and certificate with given ID does not exist.
        if (student.length === 0 || certificate.length !== 0) {
            throw new Error('Invalid Student ID: ' + studentId + ' or Course ID: ' + courseId + '. Either student does not exist or certificate already exists.');
        } else {
            let certificateObject = {
                docType: 'certificate',
                studentId: studentId,
                courseId: courseId,
                teacher: msgSender,
                certId: courseId + '-' + studentId,
                originalHash: originalHash,
                grade: gradeReceived,
                createdAt: ctx.stub.getTxTimestamp(),
                updatedAt: ctx.stub.getTxTimestamp()
            };
            // Convert the JSON object to a buffer and send it to blockchain for storage
            let dataBuffer = Buffer.from(JSON.stringify(certificateObject));
            await ctx.stub.putState(certificateKey, dataBuffer);
            // Return value of new certificate issued to student
            return certificateObject;
        }
    }

    //5. Verify Certificate
    async verifyCertificate(ctx, studentId, courseId, currentHash) {
        let verifier = ctx.clientIdentity.getID();
        let certificateKey = ctx.stub.createCompositeKey('certnet.certificate', [courseId, studentId]);

        // Fetch certificate with given ID from blockchain
        let certificateBuffer = await ctx.stub
            .getState(certificateKey)
            .catch(err => console.log(err));

        // Convert the received certificate buffer to a JSON object
        const certificate = JSON.parse(certificateBuffer.toString());

        // Check if original certificate hash matches the current hash provided for certificate
        if (certificate === undefined || certificate.originalHash !== currentHash) {
            // Certificate is not valid, issue event notifying the same
            let verificationResult = {
                certificate: courseId + '-' + studentId,
                student: studentId,
                verifier: verifier,
                result: 'xxx - INVALID',
                verifiedOn: ctx.stub.getTxTimestamp()
            };
            ctx.stub.setEvent('verifyCertificate', Buffer.from(JSON.stringify(verificationResult)));
            return true;
        } else {
            // Certificate is valid, issue event notifying the student application
            let verificationResult = {
                certificate: courseId + '-' + studentId,
                student: studentId,
                verifier: verifier,
                result: '*** - VALID',
                verifiedOn: ctx.stub.getTxTimestamp()
            };
            ctx.stub.setEvent('verifyCertificate', Buffer.from(JSON.stringify(verificationResult)));
            return true;
        }
    }


}

//exporting class 'CertnetContract' to the global namespace, so that whenever we import this particular contract.js file inside
//of index.js, we have the certification contract or the variable with which we are importing this file into mapped to this 
//particular class that we have created as part of our nodejs module. 
module.exports = CertnetContract;

