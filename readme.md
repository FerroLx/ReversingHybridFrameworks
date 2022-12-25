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


## Reversing Cordova Chapter #1 - Playing with Java

### Introduction to Cordova

Cordova is a framework that uses a custom webview with custom interfaces and webClients that allow the interaction between the JavaScript/TypeScript code, in which the developers create the application itself, and the Java side in which it interacts with the Android API. It uses modules to do so. These modules are built in Java and javascript.

Example plugin `cordova-plugin-contacts`.

The javascript that calls the `exec` method that in itself will call the java Module execute function.
![Example plugin - JavaScript](/cordova_images/plugin_javascript.png "contact.js")

The Contact Plugin main Java class.
![Example plugin - Java](/cordova_images/plugin_java.png "ContactManager.java")

The Contact Plugin main execute method.
![Example plugin - Method that is called from the javaScript](/cordova_images/plugin_method.png "ContactManager.execute")

This is **NOT** a tutorial or explanation on how to reverse cordova applications and takes in consideration that you already know who to do it.

Full scripts and tools can be found in my [github]()


### What's being loaded to the webview

Will start this analysis and scripts by getting the data from the config.xml file and ConfigXmlParser class followed by what is being loaded to the Cordova WebView.

#### From the xml file

The `config.xml` can be found in `res/xml/` and  contains some configuration data that is loaded on StartUp.

```js
// Loaded data from config.xml
var ConfigXmlParser = Java.use("org.apache.cordova.ConfigXmlParser");
ConfigXmlParser.parse.overload('org.xmlpull.v1.XmlPullParser').implementation = function (xml) {
    this.parse(xml);
    if (!this.getLaunchUrlPrefix().includes('localhost')) {
        console.log('\n#################### ConfigXmlParser Data ####################')
        console.log('--> LaunchUrlPrefix: ' + this.getLaunchUrlPrefix())
        console.log('--> XML launchUrl: ' + this.launchUrl.value)
        console.log('--> XML contentSrc: ' + this.contentSrc.value)
        console.log('--> XML service: ' + this.service.value)
        console.log('--> XML pluginClass: ' + this.pluginClass.value)
        console.log('--> XML paramType: ' + this.paramType.value)
        var launchUrlPrefix = String(this.getLaunchUrlPrefix()).replace('file:///android_asset/', '')

        // will be showed later
        //getDataFromCordovaPlugins(launchUrlPrefix)
    }
}
```

#### From the WebView.loadUrl

What is being loaded into the WebView.

```js
var SystemWebViewEngine = Java.use('org.apache.cordova.engine.SystemWebViewEngine')
SystemWebViewEngine.loadUrl.overload('java.lang.String', 'boolean').implementation = function (var1, var2) {
    console.log('\n################### SystemWebViewEngine Data ###################')
    console.log('--> WebView.loadUrl -> ', var1, ' --> ', var2)
    this.loadUrl(var1, var2)
}


```


### How to get the loaded Modules

For the loaded Modules is important to get info about the way that is used in the JavaScript and Java side.

#### Strategy One - Reading the cordova_plugins.js

The `cordova_plugins.js` has info about all the plugins that will be available in the javascript side and the clobbers (names), that will be used. 

![Example cordova_plugins.js](/cordova_images/cordova_plugins.png "cordova_plugins.js")

In the function presented bellow the `cordova_plugins.js` is read and parsed in order to get the necessary info. This method is called from the overload of the `ConfigXmlParser` because it requires the launchUrl directory.

```js
function getDataFromCordovaPlugins(launchUrlPrefix) {
    var buf = context.getAssets().open(launchUrlPrefix + "cordova_plugins.js");
    const buffer = Java.array('byte', new Array(buf.available()).fill(0))

    buf.read(buffer)
    var json = JSON.parse('{ "list": ' + strClass.$new(buffer).split('];')[0].split('module.exports = ')[1] + '] }')
    var new_json = {
        "list": []
    }

    let plugins = new Map()
    for (var i = 0; i < json['list'].length; i++) {
        try {
            var clobbers = json['list'][i]['clobbers'][0];
        } catch (e) {
            var clobbers = 'none'
        }
        var list_plugins = []
        if (plugins.has(json['list'][i]['pluginId'])) {
            list_plugins = plugins.get(json['list'][i]['pluginId'])
        } else {}
        list_plugins.push({
            'id': json['list'][i]['id'],
            'file': json['list'][i]['file'],
            clobbers
        })
        plugins.set(json['list'][i]['pluginId'], list_plugins)
    }

    console.log("\n############### Javascript Side Plugin details ###############\n")
    for (let [key, value] of plugins) {
        var js_plugins_str = "--> Plugin Name: " + key; //
        for (let js_value of value) {
            js_plugins_str = js_plugins_str.concat("\n\t-> id: " + js_value['id'] + "\n\t\t-> Js_file : " + js_value['file'] + "\n\t\t-> clobbers : " + js_value['clobbers'])
        }
        console.log(js_plugins_str)

    }
}
```



#### Strategy Two - Reading the loaded Modules

In order to get the loaded modules in the Java side the method `startupPlugins` from the `PluginManager` was overloaded. This allowed to get the `entryMap` that contains all modules info for the Java side.

```js
var HashMapNode = Java.use('java.util.HashMap$Node');
var pluginManager = Java.use("org.apache.cordova.PluginManager");
pluginManager.startupPlugins.implementation = function() {
    this.startupPlugins()

    try{
    var list = Java.cast(this.entryMap.value, Java.use("java.util.LinkedHashMap"))
    }catch{
    var list = this.entryMap.value;
    }

    console.log('\n############### Java Side Plugin details ###############\n')

    var iterator = list.entrySet().iterator();
    while (iterator.hasNext()) {
        var entry = Java.cast(iterator.next(), HashMapNode);
        var plugin_details = '--> PLUGIN NAME: ' + entry.getKey() + '\n' +
            '\t-> PLUGIN DETAILS: ' + '\n' +
            '\t\t - OnLoad : ' + entry.getValue().getClass().getDeclaredFields()[0].get(entry.getValue()) + '\n' +
            '\t\t - PluginClass : ' + entry.getValue().getClass().getDeclaredFields()[2].get(entry.getValue()) ;
        console.log(plugin_details)
    }
}
```

### Creating a Cordova Bridge Logger

The final script of this part 1 allows us to log all the data that is being passed from the javaScript side to the Java side and what it returns.

```js
var SystemExposedJsApi = Java.use('org.apache.cordova.engine.SystemExposedJsApi')
SystemExposedJsApi.exec.overload('int', 'java.lang.String', 'java.lang.String', 'java.lang.String', 'java.lang.String').implementation = function(var1, var2, var3, var4, var5) {
    console.log(var1, var2, var3, var4, var5)
    var ret = this.exec(var1, var2, var3, var4, var5)
    console.log(ret)
    if (ret == null) {
        ret_str = ret
    } else {
        var ret_array = ret.split(' ')
        var ret_str = ret_array[3]
        if (ret_array.length > 4) {
            ret_str = ret_array.slice(3, ret_array.length).join(' ')
        }
    }
    const currentDate = new Date();

    var str = currentDate + ' : ' + '\t\t-> ' + var2 + '.' + var3 + '\n\t\t\t\t\t\t\t\t\t\t\t\t- ARGS_ARRAY = ' + var5 + '\n\t\t\t\t\t\t\t\t\t\t\t\t- RETURN = ' + ret_str
    saveToLog(str)
    console.log(str)
    return ret;
}
```

### Conclusion

In this first part was possible to create a script that gets all the plugins info and logs it's calls data.

Full script can be found [**here**]().

## Reversing Cordova Chapter #2

## Reversing Cordova Chapter #2 - Playing with JavaScript

### Testing you Javascript Code

Process to test in the console.

### How to evaluate and inject Js in a Cordova app

--> imagm da função e pequena explicação

```js
var SystemWebViewEngine = Java.use('org.apache.cordova.engine.SystemWebViewEngine');
var WebView = Java.use('android.webkit.WebView');
var ValueCallback = Java.use('android.webkit.ValueCallback');
```

```js
const MyValueCallback = Java.registerClass({
                                                name: 'com.example.MyValueCallback',
                                                implements: [ValueCallback],
                                                methods: {
                                                    onReceiveValue(value) {
                                                        console.log('RECEIVED VALUE')
                                                        console.log(value)
                                                    }
                                                }
                                            }).$new();

```

```js
var SystemWebViewEngineInstance = null
SystemWebViewEngine.loadUrl.overload('java.lang.String', 'boolean').implementation = function(var1, var2) {
    this.loadUrl(var1, var2)  
    SystemWebViewEngineInstance = Java.retain(this)
    SystemWebViewEngineInstance.evaluateJavascript(`(function (){ return '1->' + Object.getOwnPropertyNames(window);})()  ; `, MyValueCallback)

}

```



### Pratical examples:

#### Getting all registered events


```js

```

#### Getting all registered functions                  


```js

```

#### Getting all registered Classes


```js

```

#### Getting the document as a String


```js

```

#### Getting 

#### Intercepting all XMLREQUESTS


```js

```

#### Frida like in Javascript example ("")


```js

```


#### Replace the console.log function


```js

```

##### Log to file


```js

```

##### Log as a Request


```js

```

## Reversing Cordova Chapter #3 - putting all together









# ReversingHybridFrameworks
