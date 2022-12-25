## Reversing Cordova Chapter #1 - Playing with Java

### Introduction to Cordova

Cordova is a framework that uses a custom webview with custom interfaces and webClients that allow the interaction between the JavaScript/TypeScript code, in which the developers create the application itself, and the Java side in which it interacts with the Android API. It uses modules to do so. These modules are built in Java and javascript.

Example plugin `cordova-plugin-contacts`.

The javascript that calls the `exec` method that in itself will call the java Module execute function.
![Example plugin - JavaScript](ReversingHybridFrameworks/cordova/cordova_images/plugin_javascript.png "contact.js")

The Contact Plugin main Java class.
![Example plugin - Java](ReversingHybridFrameworks/cordova/cordova_images/plugin_java.png "ContactManager.java")

The Contact Plugin main execute method.
![Example plugin - Method that is called from the javaScript](ReversingHybridFrameworks/cordova/cordova_images/plugin_method.png "ContactManager.execute")

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

![Example cordova_plugins.js](ReversingHybridFrameworks/cordova/cordova_images/cordova_plugins.png "cordova_plugins.js")

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
