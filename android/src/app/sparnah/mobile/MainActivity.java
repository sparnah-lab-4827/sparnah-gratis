package app.sparnah.mobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
import android.widget.Toast;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final String HOME = "https://sparnah-lab-4827.github.io/sparnah-gratis/";
    private static final int OPEN_FILE = 10, SAVE_FILE = 11;
    private final Set<String> shell = new HashSet<>(Arrays.asList("index.html","styles.css","engine.js","estimate-references.js","estimates.js","search.js","leaflets.js","stores.js","shopping.js","logos.js","logos/rewe.svg","logos/aldi.ico","logos/edeka.ico","logos/kaufland.png","logos/lidl.svg","logos/netto.svg","logos/norma.png","logos/denns.svg","logos/ebl.png","logos/mixmarkt.ico","logos/fraenky.png","logos/fristo.png","choices.js","selection.js","updates.js","vault.js","install.js","app.js","sw.js","manifest.webmanifest","icon.svg","icon-192.png","icon-512.png"));
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingJson;

    static boolean trusted(Uri u) {
        return "https".equals(u.getScheme()) && "sparnah-lab-4827.github.io".equals(u.getHost()) &&
            (u.getPort() == -1 || u.getPort() == 443) && u.getUserInfo() == null && u.getPath() != null &&
            u.getPath().startsWith("/sparnah-gratis/") && !u.getPath().contains("..");
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(0xff18624c);
        getWindow().setNavigationBarColor(0xff18624c);
        web = new WebView(this);
        web.setBackgroundColor(0xfff7f8f3);
        web.setOnApplyWindowInsetsListener((v,insets)-> {v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
        setContentView(web);
        WebSettings s=web.getSettings();
        s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(false);s.setAllowUniversalAccessFromFileURLs(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString()+" SparnahAndroid/1.0");
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u=request.getUrl();
                if(trusted(u))return false;
                if(request.isForMainFrame() && request.hasGesture() && "https".equals(u.getScheme())) {
                    try {startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception e){message("Kein Browser zum Öffnen verfügbar.");}
                }
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){return resource(request);}
        });
        ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request){return resource(request);}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(fileCallback!=null)fileCallback.onReceiveValue(null);
                fileCallback=callback;
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);
                try{startActivityForResult(intent,OPEN_FILE);}catch(Exception e){fileCallback.onReceiveValue(null);fileCallback=null;message("Dateiauswahl nicht verfügbar.");}
                return true;
            }
            @Override public boolean onJsPrompt(WebView view,String url,String message,String defaultValue,JsPromptResult result){
                if(!trusted(Uri.parse(url)) || !message.startsWith("sparnah-save:")){result.cancel();return true;}
                if(pendingJson!=null){result.cancel();return true;}
                String name=message.substring(13);
                if(!name.matches("sparnah-[a-z0-9-]+\\.json") || defaultValue==null || defaultValue.length()>5000000){result.cancel();return true;}
                try {new JSONObject(defaultValue);}catch(Exception e){result.cancel();return true;}
                pendingJson=defaultValue;
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,name);
                try{startActivityForResult(intent,SAVE_FILE);result.confirm("requested");}catch(Exception e){pendingJson=null;result.cancel();message("Speichern nicht verfügbar.");}
                return true;
            }
        });
        // Always use the authenticated web origin. The APK contains only a neutral
        // shell; private keys and personal shopping lists are never bundled.
        web.loadUrl(HOME);
    }
    private void message(String text){runOnUiThread(()->Toast.makeText(this,text,Toast.LENGTH_LONG).show());}
    private WebResourceResponse resource(WebResourceRequest request){
        if(!"GET".equals(request.getMethod()) || !trusted(request.getUrl()))return null;
        String path=request.getUrl().getPath().substring("/sparnah-gratis/".length());
        if(path.isEmpty())path="index.html";
        if(!shell.contains(path))return null;
        byte[] body=null;
        File cached=new File(getCacheDir(),"shell-"+path.replace('/','_'));
        HttpURLConnection conn=null;
        try{
            conn=(HttpURLConnection)new URL(HOME+path).openConnection();
            conn.setConnectTimeout(5000);conn.setReadTimeout(5000);conn.setInstanceFollowRedirects(false);
            conn.setRequestProperty("Cache-Control","no-cache");
            if(conn.getResponseCode()==200){try(InputStream input=conn.getInputStream()){body=read(input,3000000);}}
            if(body!=null){synchronized(this){try(FileOutputStream out=new FileOutputStream(cached)){out.write(body);}}}
        }catch(Exception ignored){}finally{if(conn!=null)conn.disconnect();}
        if(body==null){synchronized(this){try(InputStream input=new FileInputStream(cached)){body=read(input,3000000);}catch(Exception ignored){}}}
        if(body==null){try(InputStream input=getAssets().open("site/"+path)){body=read(input,3000000);}catch(Exception ignored){return null;}}
        String mime=path.endsWith(".js")?"text/javascript":path.endsWith(".css")?"text/css":path.endsWith(".png")?"image/png":path.endsWith(".ico")?"image/x-icon":path.endsWith(".svg")?"image/svg+xml":path.endsWith(".webmanifest")?"application/manifest+json":"text/html";
        Map<String,String> headers=new HashMap<>();
        headers.put("Content-Security-Policy","frame-src 'none'; object-src 'none'; base-uri 'self'");
        headers.put("X-Content-Type-Options","nosniff");
        return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,new ByteArrayInputStream(body));
    }
    private static byte[] read(InputStream input,int max) throws IOException{
        ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int n;
        while((n=input.read(buffer))!=-1){if(out.size()+n>max)throw new IOException("Too large");out.write(buffer,0,n);}return out.toByteArray();
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==OPEN_FILE && fileCallback!=null){fileCallback.onReceiveValue(result==RESULT_OK && data!=null && data.getData()!=null?new Uri[]{data.getData()}:null);fileCallback=null;}
        if(request==SAVE_FILE){
            String content=pendingJson;pendingJson=null;
            if(result==RESULT_OK && data!=null && data.getData()!=null && content!=null){
                try(OutputStream out=getContentResolver().openOutputStream(data.getData())){if(out==null)throw new IOException();out.write(content.getBytes(StandardCharsets.UTF_8));message("Datei gespeichert.");}
                catch(Exception e){message("Datei konnte nicht gespeichert werden.");}
            }
        }
    }
    @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else new AlertDialog.Builder(this).setMessage("Sparnah schließen?").setPositiveButton("Schließen",(d,w)->finish()).setNegativeButton("Bleiben",null).show();}
    @Override protected void onResume(){super.onResume();if(web!=null){web.onResume();web.evaluateJavascript("window.dispatchEvent(new Event('pageshow'))",null);}}
    @Override protected void onPause(){if(web!=null)web.onPause();super.onPause();}
    @Override protected void onDestroy(){if(fileCallback!=null)fileCallback.onReceiveValue(null);pendingJson=null;if(web!=null)web.destroy();super.onDestroy();}
}
