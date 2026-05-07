use std::path::Path;

use serde::Deserialize;

use crate::errors::{MhError, MhResult};

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ApiCredentials {
    #[serde(rename = "SPOTIFY_CLIENT_ID", default)]
    pub spotify_client_id: String,

    #[serde(rename = "SPOTIFY_CLIENT_SECRET", default)]
    pub spotify_client_secret: String,

    #[serde(rename = "TIDAL_CLIENT_ID", default)]
    pub tidal_client_id: String,

    #[serde(rename = "TIDAL_CLIENT_SECRET", default)]
    pub tidal_client_secret: String,

    #[serde(rename = "YOUTUBE_API_KEY", default)]
    pub youtube_api_key: String,

    #[serde(rename = "QOBUZ_APP_ID", default)]
    pub qobuz_app_id: String,

    #[serde(rename = "QOBUZ_AUTH_TOKEN", default)]
    pub qobuz_auth_token: String,
}

pub fn load_credentials(path: &Path) -> MhResult<ApiCredentials> {
    let data = std::fs::read_to_string(path)
        .map_err(|e| MhError::Config(format!("Cannot read credentials file: {}", e)))?;
    let creds: ApiCredentials = serde_json::from_str(&data)
        .map_err(|e| MhError::Config(format!("Cannot parse credentials file: {}", e)))?;
    Ok(creds)
}

pub fn load_credentials_or_default(path: &Path) -> ApiCredentials {
    load_credentials(path).unwrap_or_default()
}

fn yt_key() -> String {
    const O: &[u8] = &[
        0x1B, 0x13, 0x20, 0x3B, 0x09, 0x23, 0x1B, 0x6B, 0x68, 0x3F, 0x28, 0x10, 0x36, 0x69,
        0x02, 0x38, 0x3B, 0x00, 0x0D, 0x31, 0x3D, 0x3C, 0x03, 0x3F, 0x0C, 0x0D, 0x33, 0x02,
        0x35, 0x02, 0x02, 0x2B, 0x17, 0x3F, 0x32, 0x39, 0x30, 0x3F, 0x62,
    ];
    O.iter().map(|&b| (b ^ 0x5A) as char).collect()
}

pub fn bundled() -> ApiCredentials {
    ApiCredentials {
        spotify_client_id:     "".into(),
        spotify_client_secret: "".into(),
        tidal_client_id:       "N6Wz7fZO8PTt8Q5e".into(),
        tidal_client_secret:   "APESJMjvIY0fxS7QFiYqVMq0IECbcz7aon9A4pyGZ28=".into(),
        youtube_api_key:       yt_key(),
        qobuz_app_id:          String::new(),
        qobuz_auth_token:      String::new(),
    }
}
