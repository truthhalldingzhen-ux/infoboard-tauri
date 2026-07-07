use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

const TCP_HOST: &str = "127.0.0.1";
const TCP_PORT: u16 = 9988;

/// 通过 TCP 向 cookie-host.js 发送命令
pub fn tcp_send(cmd: &str, timeout_ms: u64) -> Result<String, String> {
    let addr = format!("{TCP_HOST}:{TCP_PORT}");
    let socket_addrs = addr
        .to_socket_addrs()
        .map_err(|e| format!("地址解析失败: {e}"))?
        .next()
        .ok_or_else(|| "无法解析地址".to_string())?;

    let timeout = Duration::from_millis(timeout_ms);
    let mut stream = TcpStream::connect_timeout(&socket_addrs, timeout)
        .map_err(|e| format!("TCP 连接失败: {e}"))?;

    stream
        .set_read_timeout(Some(timeout))
        .map_err(|e| format!("设置读超时失败: {e}"))?;
    stream
        .set_write_timeout(Some(timeout))
        .map_err(|e| format!("设置写超时失败: {e}"))?;

    let payload = format!("{cmd}\n");
    stream
        .write_all(payload.as_bytes())
        .map_err(|e| format!("TCP 写入失败: {e}"))?;

    let mut buf = vec![0u8; 4096];
    let n = stream
        .read(&mut buf)
        .map_err(|e| format!("TCP 读取失败: {e}"))?;

    let response = String::from_utf8_lossy(&buf[..n]).trim().to_string();
    Ok(response)
}

/// 轮询 TCP 端口直到就绪（返回 true）或超时
pub fn wait_for_tcp_port(timeout_ms: u64) -> bool {
    let start = std::time::Instant::now();
    let poll_interval = Duration::from_millis(200);

    loop {
        if start.elapsed() > Duration::from_millis(timeout_ms) {
            return false;
        }
        match tcp_send("ping", 600) {
            Ok(ref resp) if resp == "PONG" => return true,
            _ => {
                std::thread::sleep(poll_interval);
                continue;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tcp_send_never_panics() {
        // 无论端口是否监听，tcp_send 都不应 panic
        let _result = tcp_send("ping", 500);
        // 只是验证不会 crash
    }
}
