Java.perform(function () {
    var currentApplication = Java.use('android.app.ActivityThread').currentApplication();
    var context = currentApplication.getApplicationContext();
    var strClass = Java.use('java.lang.String');

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
            getDataFromCordovaPlugins(launchUrlPrefix)
        }
    }

    // Loaded URL SystemWebViewEngine
    var SystemWebViewEngine = Java.use('org.apache.cordova.engine.SystemWebViewEngine')
    SystemWebViewEngine.loadUrl.overload('java.lang.String', 'boolean').implementation = function (var1, var2) {
        console.log('\n################### SystemWebViewEngine Data ###################')
        console.log('--> WebView.loadUrl -> ', var1, ' --> ', var2)
        this.loadUrl(var1, var2)
    }

    // Reads and parses cordova_plugins.js
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

    // Gets all data from PluginManager entryMap
    var HashMapNode = Java.use('java.util.HashMap$Node');
    var pluginManager = Java.use("org.apache.cordova.PluginManager");
    pluginManager.startupPlugins.implementation = function () {
        this.startupPlugins()

        try {
            var list = Java.cast(this.entryMap.value, Java.use("java.util.LinkedHashMap"))
        } catch {
            var list = this.entryMap.value;
        }

        console.log('\n############### Java Side Plugin details ###############\n')

        var iterator = list.entrySet().iterator();
        while (iterator.hasNext()) {
            var entry = Java.cast(iterator.next(), HashMapNode);
            var plugin_details = '--> PLUGIN NAME: ' + entry.getKey() + '\n' +
                '\t-> PLUGIN DETAILS: ' + '\n' +
                '\t\t - OnLoad : ' + entry.getValue().getClass().getDeclaredFields()[0].get(entry.getValue()) + '\n' +
                '\t\t - PluginClass : ' + entry.getValue().getClass().getDeclaredFields()[2].get(entry.getValue());
            console.log(plugin_details)

        }


    }

    // Creates the Logger
    var logFirstTime = true
    var SystemExposedJsApi = Java.use('org.apache.cordova.engine.SystemExposedJsApi')
    SystemExposedJsApi.exec.overload('int', 'java.lang.String', 'java.lang.String', 'java.lang.String', 'java.lang.String').implementation = function (var1, var2, var3, var4, var5) {
        var ret = this.exec(var1, var2, var3, var4, var5)
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
        if (logFirstTime) {
            console.log('\n######################## LOGGER ########################\n')
            logFirstTime = false
        }
        console.log(str)
        return ret;
    }
})