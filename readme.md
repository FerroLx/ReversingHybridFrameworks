# Reversing Hybrid Frameworks

**Disclosure:** Using the scripts and tools presented **can and would expose data that the developers need to keep protected**. I'm not responsible by any means by any wrongdoing done using them.

In this articles we are going to take a deeper look at some of the most common hybrid frameworks and how it's possible to perform some type of dynamic analysis in those applications.

This study was perform because of the lack of dynamic data, and in some cases any data, we have when performing analysis to any application that uses a hybrid Framework.

In fact, in my opinion, the fact that all use the same code base, even from version of the framework to other versions, can lead us to the conclusion that after a first in depth analysis and creation of tools, the data that can be collected from this applications is imaginable.

The main objective in all the cases is going to have.
- Info from Libraries/Modules that perform the connection between the Java Code and Hybrid code.
- Logger of the data that is being passed between the Java Code and Hybrid code.
- Info from the hybrid Framework code, in the cases it's necessary.
- Logger of the data that is being called in the hybrid Framework.
- Teach my process when reversing frameworks.

At the moment these are the frameworks **ReVerSed**:
- **Cordova:tm:**
- **React Native:tm:**

Most of the scripts and tools are for advanced users with some reversing knowledge and 
experience with Frida and Android.



## Reversing Strategy

Using a static analysis are identified the **"critical/vulnerable"** areas of the frameworks that are then explored dynamically.

The main targeted areas are:
- The way the connection between the Java and hybrid code is done.
- How and what code is loaded in the framework code itself.

The first part of this project will focus in the Cordova:tm: framework and will be divided in three parts:
1. Playing with Java 
2. Playing with JavaScript
3. Putting all together


