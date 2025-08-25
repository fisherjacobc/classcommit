# ClassCommit

![Icons](https://skillicons.dev/icons?i=next,react,tailwind,typescript,prisma,postgres,vercel)

> [!NOTE]
> This is made by two highschoolers for their Senior Capstone Project

A web-based application that brings the power of GitHub into programming classrooms.

# Technical Proposal Submitted to Teacher
## The Problem
As high school programming students, we noticed that many students track their progress and/or work on assignments differently than each other. Many of the ways the students do this lack the use of a version control system, such as Git — most commonly using Github as the interface. Most students have it set up to be through their Google Drive, which doesn’t have version history for these files, and may be harder to access at times. Also it is harder for the teacher to help with our work only having a video as a medium to see our code.
## The Solution
Our solution is to make a web-based application that brings the power of GitHub into programming classrooms. Students and teachers can log in using GitHub OAuth, ensuring secure authentication and seamless integration with GitHub APIs. Teachers can create and manage “classes” and “assignments” with detailed instructions, starter code, and documentation written in markdown. Students can join classes using codes and work on assignments in a built-in code editor, which saves progress automatically and locally. When ready, students can push their changes to a GitHub branch and submit a pull request for teacher feedback. Using a rubric, teachers can view and comment on code inline, track commit histories, assign peer reviewers, and grade submissions. Group assignments are also supported, with individual contribution tracking. Our stack will consist of: Typescript, Next.js, tRPC, AuthJS, and MongoDB. We chose these since they are leading technologies in the field.
## Criteria
1. [Both] clients log-in using The Application’s Github integration
    a. Once a teacher logs in, they can create a “class” and can give students a class code to join.
    b. Once a student logs in, they can see any classes they are a part of, and can join a new class using a code.
2. Metadata, such as classes, assignments, and other information is saved in a database.
3. A [student] client can edit their code in a built-in code editor.
    a. Code is auto-saved locally to the device, but will need to be saved to the assigned Github branch by the student.
4. A [teacher] client can view any student's code and make inline comments or suggestions.
    a. Teacher feedback is linked to specific lines and/or files in the code, similar to Github pull request reviews.
5. A [teacher] client can create and manage classes with assignments, documentation, example code, and due dates.
    a. Teachers can include detailed instructions and/or documentation along with optional starter code using markdown.
    b. Assignments can be individual (default) or group work.
        i. Groups can be generated manually or automatically.
6. A [student] client can submit their code as a “pull request” for review.
    a. This uses the Github Pull Request APIs to handle most aspects of this.
7. A [student] client can participate in peer reviews of classmates’ code.
    a. When enabled by the teacher, they can assign students manually or randomly to review work and provide feedback, similar to how it is done to criterion #2
8. A [teacher] client can track individual and group progress on assignments
    a. The teacher can see the commit history and individual contributions on each assignment.
9. A [student] client can create issues to track their progress on an assignment.
    a. A teacher can also opt to generate some predetermined issues that students must take care of during the assignment.
10. A [teacher] client can leave rubric-based feedback and grades per assignment
    a. This can include a final score, comments, and they can reference specific files and/or lines of code.
    b. Grades can be optionally synced to the Canvas LMS via an IMS.
