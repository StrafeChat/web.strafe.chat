//     ws?.current.addEventListener("message", handleWsMessage);
  //     ws?.current.addEventListener("close", handleWsClose);
  //     ws?.current.addEventListener("error", handleWsError);
  //     document.addEventListener("contextmenu", (event) => {
  //       if ((event.target as HTMLElement).id != "textbox")
  //         event.preventDefault();
  //     });

  // const handleWsOpen = useCallback(
  //   (_event: Event) => {
  //     console.log("Connected");
  //     clearCache();
  //     setClientError(false);
  //     connectedRef.current = true;
  //     fetch(`${process.env.NEXT_PUBLIC_API}/users/@me/relationships`, {
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: cookie.get("token")!,
  //       },
  //     }).then(async (res) => {
  //       const data = await res.json();

  //       if (!res.ok) return console.log(data);

  //       setRelationships(data.relationships);
  //     });

  //     fetch(`${process.env.NEXT_PUBLIC_API}/users/@me/rooms`, {
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: cookie.get("token")!,
  //       },
  //     }).then(async (res) => {
  //       const data = await res.json();

  //       if (!res.ok) return console.log(data);

  //       setPMs([...data.rooms]);
  //     });
  //   },
  //   [setPMs, setRelationships]
  // );

  // const handleWsMessage = useCallback(
  //   (evt: MessageEvent<any>) => {
  //     const { op, data, event } = JSON.parse(evt.data);
  //     switch (op) {
  //       case 0:
  //         setInterval(() => {
  //           ws?.current?.send(
  //             JSON.stringify({
  //               op: 1,
  //               data: null,
  //             })
  //           );
  //         }, data.heartbeat_interval);
  //         ws?.current?.send(
  //           JSON.stringify({ op: 2, data: { token: cookie.get("token") } })
  //         );
  //         break;
  //       case 3:
  //         switch (event) {
  //           case "READY":
  //             setUser(data);
  //             setClientError(false);
  //             break;
  //         }
  //         break;
  //       case 4:
  //         switch (data.status) {
  //           case "accepted":
  //             setRelationships((prev) => {
  //               const updatedRelationships = prev.map((relationship) => {
  //                 if (
  //                   relationship.receiver_id === data.receiver_id &&
  //                   relationship.sender_id === data.sender_id
  //                 ) {
  //                   return {
  //                     ...relationship,
  //                     status: "accepted",
  //                   } as Relationship;
  //                 }
  //                 return relationship;
  //               });

  //               return updatedRelationships;
  //             });
  //             break;
  //           case "rejected":
  //           case "deleted":
  //             setRelationships((prev) =>
  //               prev.filter((relationship) => {
  //                 console.log(relationship.receiver_id, data.receiver_id);
  //                 return (
  //                   relationship.receiver_id != data.receiver_id &&
  //                   relationship.sender_id != data.sender_id
  //                 );
  //               })
  //             );
  //             break;
  //           case "pending":
  //             setRelationships((prev) => [...prev, data]);
  //             break;
  //         }
  //         break;
  //     }
  //   },
  //   [setRelationships, setUser, ws]
  // );

  // const handleWsClose = useCallback(
  //   (event: CloseEvent) => {
  //     connectedRef.current = false;
  //     setClientError(true);
  //     switch (event.code) {
  //       case 4004:
  //         router.push("/login");
  //         break;
  //       default:
  //         if (ws?.current?.CLOSED && !ws.current?.CONNECTING) {
  //           ws.current = new WebSocket(process.env.NEXT_PUBLIC_WS!);
  //           ws?.current.addEventListener("open", handleWsOpen);
  //           ws?.current.addEventListener("message", handleWsMessage);
  //           ws?.current.addEventListener("close", handleWsClose);
  //           ws?.current.addEventListener("error", handleWsError);
  //           document.addEventListener("contextmenu", (event) => {
  //             if ((event.target as HTMLElement).id != "textbox")
  //               event.preventDefault();
  //           });
  //         }
  //         break;
  //     }
  //   },
  //   [handleWsMessage, handleWsOpen, router, ws]
  // );

  // const handleWsError = (_event: Event) => {
  //   connectedRef.current = false;
  //   setClientError(true);
  // };

  // useEffect(() => {
  //   if (pathname == "/register" || pathname == "/login") return;
  //   const token = cookie.get("token");
  //   if (!token) return router.push("/login");
  //   if (!connectedRef.current) {
  //     ws!.current = new WebSocket(process.env.NEXT_PUBLIC_WS!);
  //     ws?.current.addEventListener("open", handleWsOpen);
  //     ws?.current.addEventListener("message", handleWsMessage);
  //     ws?.current.addEventListener("close", handleWsClose);
  //     ws?.current.addEventListener("error", handleWsError);
  //     document.addEventListener("contextmenu", (event) => {
  //       if ((event.target as HTMLElement).id != "textbox")
  //         event.preventDefault();
  //     });
  //   }

  //   return () => {
  //     ws?.current?.removeEventListener("open", handleWsOpen);
  //     ws?.current?.removeEventListener("message", handleWsMessage);
  //     ws?.current?.removeEventListener("close", handleWsClose);
  //     ws?.current?.removeEventListener("error", handleWsError);
  //     document.removeEventListener("contextmenu", (event) => {
  //       if ((event.target as HTMLElement).id != "textbox")
  //         event.preventDefault();
  //     });
  //   };
  // }, [
  //   connectedRef,
  //   handleWsClose,
  //   handleWsMessage,
  //   handleWsOpen,
  //   pathname,
  //   router,
  //   setRelationships,
  //   ws,
  // ]);